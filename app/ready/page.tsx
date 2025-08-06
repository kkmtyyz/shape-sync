'use client';

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { generateClient } from "aws-amplify/data";
import { events, type EventsChannel } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import * as PIXI from "pixi.js";

const client = generateClient<Schema>();

type Shape = {
  id?: string;
  color?: string;
  shape?: string;
  x?: number;
  y?: number;
};

export default function GamePage() {
  const searchParams = useSearchParams();
  const user_id = searchParams.get("id");
  const lobby_id = searchParams.get("lobby_id");
  const router = useRouter();

  const [taskToken, setTaskToken] = useState<string>();
  const [personalMessage, setPersonalMessage] = useState<Record<string, any>>();
  const [lobbyMessage, setLobbyMessage] = useState<Record<string, any>>();
  const [showWait, setShowWait] = useState(false);
  // ユーザーがゲーム開始を許可した場合trueになる
  let startFlag = useRef<Boolean>(false);

  // お手本用のキャンバス
  const resultShapeRef = useRef<HTMLDivElement>(null);
  // ユーザー操作用のキャンバス
  const gameRef = useRef<HTMLDivElement>(null);
  // 自分の図形情報
  const myShape = useRef<Shape>({id: "dummy", color: "#FFFFFF", shape: "square", x: 0, y: 0});
  // お手本の図形情報
  const [answerShapes, setAnswerShapes] = useState<Array<Shape>>([]);

  // PersonalMessage処理
  useEffect(() => {
    console.log('personalMessage', personalMessage);
    // myShape とanswerShapes をセット
    if (personalMessage?.event?.message && myShape.current.id === "dummy") {
      console.log('message', personalMessage.event.message);
      const found = structuredClone(personalMessage.event.message.find((s: Shape) => s.id === user_id));
      if (found) myShape.current = found;
      setAnswerShapes(personalMessage.event.message);
    }
    // taskTokenセット
    if (personalMessage?.event?.taskToken && !taskToken) {
      setTaskToken(personalMessage.event.taskToken);
    }
  }, [personalMessage]);

  // PersonalMessageサブスクライブ
  useEffect(() => {
    let channel: EventsChannel;
    const subscribe = async () => {
      const channelName = `/default/${lobby_id}/${user_id}`;
      console.log('personalChannel', channelName);
      channel = await events.connect(channelName);
      channel.subscribe({
        next: (data) => setPersonalMessage(data),
        error: (err) => console.error("error", err),
      });
    };
    subscribe();
    return () => channel?.close();
  }, []);

  // LobbyMessage処理
  useEffect(() => {
    console.log('lobbyMessage', lobbyMessage);
    if (!lobbyMessage) return;
    if (lobbyMessage.event?.message == 'start_game' && startFlag.current == true) {
      router.push(`/game?id=${user_id}&lobby_id=${encodeURIComponent(lobby_id)}`);
    }
  }, [lobbyMessage]);

  // LobbyMessageサブスクライブ
  useEffect(() => {
    let channel: EventsChannel;
    const connectAndSubscribe = async () => {
      const channel_name = '/default/' + lobby_id;
      console.log('channel_name', channel_name);
      channel = await events.connect(channel_name);

      // チャネル `/default/<lobby_id>` のサブスクリプションを開始
      channel.subscribe({
        next: (data) => {
          setLobbyMessage(data);
        },
        error: (err) => console.error('error', err),
      });
    };

    connectAndSubscribe();

    return () => channel && channel.close();
  }, []);

  // お手本の描画
  useEffect(() => {
    if (!answerShapes || answerShapes.length === 0) return;
    console.log('answerShapes', answerShapes);
    const app = new PIXI.Application({
      width: 300,
      height: 300,
      backgroundColor: 0xFFFFFF,
    });

    if (resultShapeRef.current) {
      resultShapeRef.current.appendChild(app.view);
    }

    const playerGraphicsMap = new Map<string, PIXI.Graphics>();

    const size = 30;
    //const offset = 150 + size / 2;
    const offset = 150 - size / 2;

    const createShapeGraphic = (shape: string, color: string) => {
      const g = new PIXI.Graphics();
      g.beginFill(PIXI.utils.string2hex(color));
      if (shape === "circle") {
        g.drawCircle(0, 0, size / 2);
      } else if (shape === "square") {
        g.drawRect(0, 0, size, size);
      } else if (shape === "triangle") {
        g.moveTo(0 + size/2, 0).lineTo(0, size).lineTo(size, size).lineTo(0 + size/2, 0);
      }
      g.endFill();
      return g;
    };

    // 初期描画
    answerShapes.forEach((p) => {
      const g = createShapeGraphic(p.shape, p.color);
      g.x = p.x + offset;
      g.y = p.y + offset;
      app.stage.addChild(g);
      playerGraphicsMap.set(p.id, g);
    });

    return () => {
      app.destroy(true, true);
    };
  }, [answerShapes]);


  // ユーザー図形の描画
  useEffect(() => {
    console.log('myShape', myShape);
    const app = new PIXI.Application({
      width: 500,
      height: 300,
      backgroundColor: 0xFFFFFF,
    });

    if (gameRef.current) {
      gameRef.current.appendChild(app.view);
    }

    const playerGraphicsMap = new Map<string, PIXI.Graphics>();

    const size = 30;
    //const offset = 150 + size / 2;
    const offset = 250 - size / 2;
    const createShapeGraphic = (shape: string, color: string) => {
      const g = new PIXI.Graphics();
      //g.beginFill(color);
      g.beginFill(PIXI.utils.string2hex(color));
      if (shape === "circle") {
        g.drawCircle(0, 0, size / 2);
      } else if (shape === "square") {
        g.drawRect(0, 0, size, size);
      } else if (shape === "triangle") {
        g.moveTo(0 + size/2, 0).lineTo(0, size).lineTo(size, size).lineTo(0 + size/2, 0);
      }
      g.endFill();
      return g;
    };

    // 初期描画
    const g = createShapeGraphic(myShape.current.shape, myShape.current.color);

    g.x = myShape.current.x + offset;
    g.y = myShape.current.y + offset;
    app.stage.addChild(g);
    playerGraphicsMap.set(myShape.current.id, g);

    // キー操作
    const keys: Record<string, boolean> = {};

    //const handleKeyDown = (e: KeyboardEvent) => (keys[e.key] = true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault(); // ← ここでスクロールを防止
      }
      keys[e.key] = true;
    };

    //const handleKeyUp = (e: KeyboardEvent) => (keys[e.key] = false);
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };

    //window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    app.ticker.add(() => {
      //const me = players.find((p) => p.id === myId);
      if (!myShape.current) return;

      const speed = 5;
      if (keys["ArrowUp"]) myShape.current.y -= speed;
      if (keys["ArrowDown"]) myShape.current.y += speed;
      if (keys["ArrowLeft"]) myShape.current.x -= speed;
      if (keys["ArrowRight"]) myShape.current.x += speed;

      // 範囲内に制限（図形がはみ出さないように）
      myShape.current.x = Math.max(0, Math.min(500 - size, myShape.current.x));
      myShape.current.y = Math.max(0, Math.min(300 - size, myShape.current.y));

      // 描画更新
      const g2 = playerGraphicsMap.get(myShape.current.id);
      if (g2) {
        g2.x = myShape.current.x;
        g2.y = myShape.current.y;
      }

    });

    return () => {
      app.destroy(true, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [answerShapes]);

  const startGame = async () => {
    if (!taskToken) return;
    await client.queries.sendTaskSuccessSfn({ taskToken });
    startFlag.current = true;
    setShowWait(true); // モーダル表示
  };



/*

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Record<string, boolean>>({});

  // 初期描画用キャンバス
  const answerDraw = () => {
    const canvas = document.getElementById("myCanvas") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !personalMessage) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shapes = personalMessage.event?.message || [];

    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;
    const size = 30;

    shapes.forEach((shape: Shape) => {
      const { x = 0, y = 0, color = 'black', shape: type = 'square' } = shape;
      const cx = offsetX + x;
      const cy = offsetY + y;

      ctx.fillStyle = color;

      if (type === "square") {
        ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      } else if (type === "circle") {
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === "triangle") {
        ctx.beginPath();
        ctx.moveTo(cx, cy - size / 2);
        ctx.lineTo(cx + size / 2, cy + size / 2);
        ctx.lineTo(cx - size / 2, cy + size / 2);
        ctx.closePath();
        ctx.fill();
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 30;
    const handleKeyDown = (e: KeyboardEvent) => keys.current[e.key] = true;
    const handleKeyUp = (e: KeyboardEvent) => keys.current[e.key] = false;

    const update = () => {
      //console.log('update');
      const shape = myShape.current;
      if (!shape) return;
      if (shape.x == null || shape.y == null) return;

      const speed = 5;
      const halfSize = size / 2;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      let newX = shape.x;
      let newY = shape.y;

      if (keys.current['ArrowUp']) newY -= speed;
      if (keys.current['ArrowDown']) newY += speed;
      if (keys.current['ArrowLeft']) newX -= speed;
      if (keys.current['ArrowRight']) newX += speed;

      const maxX = canvasWidth / 2 - halfSize;
      const maxY = canvasHeight / 2 - halfSize;

      shape.x = Math.max(-maxX, Math.min(maxX, newX));
      shape.y = Math.max(-maxY, Math.min(maxY, newY));
    };

    const draw = () => {
      //console.log('draw');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!myShape.current) return;
      const { x, y, color, shape } = myShape.current;
      const cx = canvas.width / 2 + x;
      const cy = canvas.height / 2 + y;
      ctx.fillStyle = color;

      if (shape === "square") {
        ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      } else if (shape === "circle") {
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === "triangle") {
        ctx.beginPath();
        ctx.moveTo(cx, cy - size / 2);
        ctx.lineTo(cx + size / 2, cy + size / 2);
        ctx.lineTo(cx - size / 2, cy + size / 2);
        ctx.closePath();
        ctx.fill();
      }
    };

    const loop = () => {
      update();
      draw();
      requestAnimationFrame(loop);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    loop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [taskToken]);

  type Player = {
    id: string;
    color: string;
    shape: string;
    x: number;
    y: number;
  };
  
  const players: Player[] = [
    { id: "player-uuid-123", color: "#ff00ff", shape: "丸", x: 100, y: 150 },
    { id: "player-uuid-456", color: "#00ffff", shape: "四角", x: 200, y: 150 },
    { id: "player-uuid-789", color: "#00ff00", shape: "三角", x: 300, y: 150 },
  ];
  
  const targetPattern = [
    { shape: "丸", dx: -50, dy: 0 },
    { shape: "四角", dx: 0, dy: 0 },
    { shape: "三角", dx: 50, dy: 0 },
  ];
  
  const myId = "player-uuid-123";
  const canvasRef2 = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const app = new PIXI.Application({
      width: 800,
      height: 600,
      backgroundColor: 0xf0f0f0,
    });

    if (canvasRef2.current) {
      canvasRef2.current.appendChild(app.view);
    }

    const playerGraphicsMap = new Map<string, PIXI.Graphics>();

    const createShapeGraphic = (shape: string, color: string) => {
      const g = new PIXI.Graphics();
      g.beginFill(PIXI.utils.string2hex(color));
      if (shape === "丸") {
        g.drawCircle(0, 0, 20);
      } else if (shape === "四角") {
        g.drawRect(-20, -20, 40, 40);
      } else if (shape === "三角") {
        g.moveTo(0, -20).lineTo(20, 20).lineTo(-20, 20).lineTo(0, -20);
      }
      g.endFill();
      return g;
    };

    // 初期描画
    players.forEach((p) => {
      const g = createShapeGraphic(p.shape, p.color);
      g.x = p.x;
      g.y = p.y;
      app.stage.addChild(g);
      playerGraphicsMap.set(p.id, g);
    });

    // キー操作
    const keys: Record<string, boolean> = {};

    //const handleKeyDown = (e: KeyboardEvent) => (keys[e.key] = true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault(); // ← ここでスクロールを防止
      }
      keys[e.key] = true;
    };

    //const handleKeyUp = (e: KeyboardEvent) => (keys[e.key] = false);
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };

    //window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    app.ticker.add(() => {
      const me = players.find((p) => p.id === myId);
      if (!me) return;

      const speed = 5;
      if (keys["ArrowUp"]) me.y -= speed;
      if (keys["ArrowDown"]) me.y += speed;
      if (keys["ArrowLeft"]) me.x -= speed;
      if (keys["ArrowRight"]) me.x += speed;

      // 範囲内に制限（図形がはみ出さないように）
      const margin = 20; // 図形の最大サイズ半分
      me.x = Math.max(margin, Math.min(800 - margin, me.x));
      me.y = Math.max(margin, Math.min(600 - margin, me.y));

      // モックネットワーク同期
      simulateNetworkSync();

      // 描画更新
      players.forEach((p) => {
        const g = playerGraphicsMap.get(p.id);
        if (g) {
          g.x = p.x;
          g.y = p.y;
        }
      });

      checkPatternMatch();
    });

    const simulateNetworkSync = () => {
      // 実際の通信はなし（ローカル同期）
    };

    const checkPatternMatch = () => {
      const center = getCenterPoint(players);
      const relativePositions = players.map((p) => ({
        shape: p.shape,
        dx: Math.round(p.x - center.x),
        dy: Math.round(p.y - center.y),
      }));

      const isMatch = targetPattern.every((t) =>
        relativePositions.some(
          (p) =>
            p.shape === t.shape &&
            Math.abs(p.dx - t.dx) < 10 &&
            Math.abs(p.dy - t.dy) < 10
        )
      );

      if (resultRef.current) {
        resultRef.current.textContent = isMatch ? "お手本完成！" : "まだ未完成";
      }
    };

    const getCenterPoint = (players: Player[]) => {
      const xs = players.map((p) => p.x);
      const ys = players.map((p) => p.y);
      return {
        x: xs.reduce((a, b) => a + b, 0) / players.length,
        y: ys.reduce((a, b) => a + b, 0) / players.length,
      };
    };

    return () => {
      app.destroy(true, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
*/
  return (
    <div>
      <h1>ゲームの説明</h1>
      <p>{lobby_id}</p>
      <h3>他のプレイヤーと協力して以下の図形を完成させましょう！</h3>
      <div ref={resultShapeRef}></div>
      <h3 className="mt-3">あなたの図形は以下です。方向キーで動かしてみましょう！</h3>
      <div ref={gameRef} style={{ marginTop: "10px", fontSize: "20px" }}></div>
      <button onClick={startGame} type="button" className="btn btn-success my-3 w-50">準備完了</button>

      {showWait && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-body">
                <h3>他のプレイヤーの準備完了を待っています</h3>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

