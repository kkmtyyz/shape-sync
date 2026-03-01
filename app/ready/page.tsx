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

  function createShapeGraphic(shape: string, color: string) {
    console.log('createShapeGraphic shape', shape);  
    console.log('createShapeGraphic color', color);  
    const g = new PIXI.Graphics();
    const size = 40;
    g.beginFill(PIXI.utils.string2hex(color));
    if (shape === "circle") {
      g.drawCircle(size/2, size/2, size/2);
    } else if (shape === "square") {
      g.drawRect(0, 0, size, size);
    } else if (shape === "triangle") {
      g.moveTo(0 + size/2, 0).lineTo(0, size).lineTo(size, size).lineTo(0 + size/2, 0);
    }
    g.endFill();
    return g;
  }

  // お手本の描画
  useEffect(() => {
    if (!answerShapes || answerShapes.length === 0) return;
    console.log('answerShapes', answerShapes);
    const width = 300;
    const height = 300;
    const app = new PIXI.Application({
      width: width,
      height: height,
      backgroundColor: 0xFFFFFF,
    });

    if (resultShapeRef.current) {
      resultShapeRef.current.appendChild(app.view as unknown as HTMLCanvasElement);
    }

    const playerGraphicsMap = new Map<string, PIXI.Graphics>();

    const size = 40;
    const offset = width/2 - size/2;

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
    const width = 500;
    const height = 300;
    const app = new PIXI.Application({
      width: width,
      height: height,
      backgroundColor: 0xFFFFFF,
    });

    if (gameRef.current) {
      gameRef.current.appendChild(app.view);
    }

    const playerGraphicsMap = new Map<string, PIXI.Graphics>();

    const size = 40;

    // 初期描画
    const g = createShapeGraphic(myShape.current.shape, myShape.current.color);

    if (myShape.current.shape === "circle") {
      g.x = size/2;
      g.y = size/2;
    } else {
      g.x = 0;
      g.y = 0;
    }
    app.stage.addChild(g);
    playerGraphicsMap.set(myShape.current.id, g);

    // キー操作
    const keys: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
      keys[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    app.ticker.add(() => {
      if (!myShape.current) return;

      const speed = 3;
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
    await client.mutations.sendTaskSuccessSfn({ taskToken });
    startFlag.current = true;
    setShowWait(true); // モーダル表示
  };


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

