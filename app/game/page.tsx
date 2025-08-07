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

type PlayerData = {
  graphic: PIXI.Graphics;
  shape: Shape;
  color: string;
};

export default function ReadyPage() {
  const searchParams = useSearchParams();
  const user_id = searchParams.get("id");
  const lobby_id = searchParams.get("lobby_id");
  const router = useRouter();

  const [taskToken, setTaskToken] = useState<string>();
  const [personalMessage, setPersonalMessage] = useState<Record<string, any>>();
  const [lobbyMessage, setLobbyMessage] = useState<Record<string, any>>();
  const [showWait, setShowWait] = useState(false);
  const [isCleared, setIsCleared] = useState<boolean>(false);
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
  // ユーザーの図形情報（自分含む）
  const players = useRef<Record<string, PlayerData>>({});
  // ゲーム用チャネルのwebsocketコネクション
  const lobbyGameChannelRef = useRef<EventsChannel>();
  // ゲーム本体
  const appRef = useRef<any>();
  // targetOffsetsをキャッシュするためのref
  const targetOffsetsRef = useRef<Array<{shape: string, color: string, dx: number, dy: number}>>([]);

  // PersonalMessage処理
  useEffect(() => {
    console.log('personalMessage', personalMessage);
    // myShape とanswerShapes, players をセット
    if (personalMessage?.event?.message && myShape.current.id === "dummy") {
      // myShape
      console.log('message', personalMessage.event.message);
      const found = personalMessage.event.message.find((s: Shape) => s.id === user_id);
      if (found) myShape.current = found;
      // answerShapes
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
      router.push(`/game?id=${user_id}&lobby_id=${encodeURIComponent(lobby_id as string)}`);
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

  // LobbyGameサブスクライブ
  useEffect(() => {
    let channel: EventsChannel;
    const connectAndSubscribe = async () => {
      const channel_name = '/default/' + lobby_id + '/game';
      console.log('LobbyGame channel_name', channel_name);
      channel = await events.connect(channel_name);

      // サブスクリプションを開始
      channel.subscribe({
        next: (data) => {
          // クリア済みなら処理をスキップ（他プレイヤーの図形の動きを止める）
          if (isCleared) return;
          
          // ゲームの処理
          console.log('game data', data);
          console.log('game data event', data.event.id);
          console.log('user_id', user_id);
          //const data = JSON.parse(event.data);
          const { id, shape, color, x, y } = data.event;

          if (id === user_id) return;
          console.log('other player', data.event);
          console.log('appRef.current', appRef.current);
          console.log('players.current1', players.current);

          if (!players.current[id]) {
            console.log('players.current2', players.current);
            const g = createShapeGraphic(shape.shape, color);
            g.x = x;
            g.y = y;
            appRef.current.stage.addChild(g);
            players.current[id] = { graphic: g, shape, color };
          } else {
            players.current[id].graphic.x = x;
            players.current[id].graphic.y = y;
          }
        },
        error: (err) => console.error('error', err),
      });
      lobbyGameChannelRef.current = channel;
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

  // answerShapesからtargetOffsetsを計算
  useEffect(() => {
    if (!answerShapes || answerShapes.length < 2) return;
    
    // 基準点（中心点）を計算
    const centerX = answerShapes.reduce((sum, shape) => sum + (shape.x || 0), 0) / answerShapes.length;
    const centerY = answerShapes.reduce((sum, shape) => sum + (shape.y || 0), 0) / answerShapes.length;
    
    // 各図形の中心点からの相対位置を計算
    targetOffsetsRef.current = answerShapes
      .filter(shape => shape.shape !== undefined && shape.color !== undefined)
      .map(shape => ({
        shape: shape.shape!,
        color: shape.color!,
        dx: (shape.x || 0) - centerX,
        dy: (shape.y || 0) - centerY,
      }));

    console.log('Target offsets calculated:', targetOffsetsRef.current);
  }, [answerShapes]);

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
      resultShapeRef.current.appendChild(app.view as unknown as HTMLCanvasElement);
    }

    const size = 40;
    const offset = 150 - size / 2;

    // 初期描画
    answerShapes.forEach((p) => {
      const g = createShapeGraphic(p.shape, p.color);
      if (p.shape === "circle") {
        g.x = (p.x + size/2) + offset;
        g.y = (p.y + size/2) + offset;
      } else {
        g.x = p.x + offset;
        g.y = p.y + offset;
      }
      app.stage.addChild(g);
    });

    return () => {
      app.destroy(true, true);
    };
  }, [answerShapes]);


  let lastSent = 0;
  const sendInterval = 1; // ms

  // ゲームの描画
  const width = 500;
  const height = 300;
  useEffect(() => {
    console.log('myShape', myShape.current);
    const app = new PIXI.Application({
      width: width,
      height: height,
      backgroundColor: 0xFFFFFF,
    });
    appRef.current = app;

    if (gameRef.current) {
      gameRef.current.appendChild(app.view as unknown as HTMLCanvasElement);
    }

    const size = 40;

    console.log('myShape.current', myShape.current);
    console.log('myShape.current.color', myShape.current.color);
    answerShapes.map(answerShape => {
      const myGraphic = createShapeGraphic(answerShape.shape, answerShape.color);
      if (answerShape.shape === "circle") {
        myGraphic.x = Math.floor(Math.random() * (width-size)) + size/2;
        myGraphic.y = Math.floor(Math.random() * (height-size)) + size/2;
      } else {
        myGraphic.x = Math.floor(Math.random() * (width-size));
        myGraphic.y = Math.floor(Math.random() * (height-size));
      }
      app.stage.addChild(myGraphic);

      players.current[answerShape.id] = {
        graphic: myGraphic,
        shape: answerShape,
        color: answerShape.color,
      };
    });

    // キー操作
    const keys: Record<string, boolean> = {};

    const speed = 5;
    app.ticker.add(() => {
      // クリア済みなら処理をスキップ（図形の動きを止める）
      if (isCleared) {
        checkCompletion(); // クリア状態の確認は継続
        return;
      }
      
      const now = Date.now();
      const my = players.current[user_id];
      if (!my) return;

      let moved = false;
      if (keys["ArrowUp"]) { my.graphic.y -= speed; moved = true; }
      if (keys["ArrowDown"]) { my.graphic.y += speed; moved = true; }
      if (keys["ArrowLeft"]) { my.graphic.x -= speed; moved = true; }
      if (keys["ArrowRight"]) { my.graphic.x += speed; moved = true; }

      // 範囲内に制限（図形がはみ出さないように）
      my.graphic.x = Math.max(0, Math.min(500 - size, my.graphic.x));
      my.graphic.y = Math.max(0, Math.min(300 - size, my.graphic.y));

      if (moved && now - lastSent > sendInterval) {
        const msg = {
          id: user_id,
          shape: my.shape,
          color: my.color,
          x: my.graphic.x,
          y: my.graphic.y,
        };
        console.log('sent1');
        lobbyGameChannelRef.current.publish(msg);
        console.log('sent2');
        lastSent = now;
      }

      checkCompletion();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      // クリア済みなら処理をスキップ
      if (isCleared) return;
      
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault(); // ← ここでスクロールを防止
      }
      keys[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // クリア済みなら処理をスキップ
      if (isCleared) return;
      
      keys[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      app.destroy(true, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [answerShapes]);

  function checkCompletion() {
    // すでにクリア済みなら処理しない
    if (isCleared) return;
    
    // プレイヤーが少なすぎる場合は判定しない
    const playerEntries = Object.values(players.current);
    console.log('プレイヤー数:', playerEntries.length);
    if (playerEntries.length < 2) {
      console.log('プレイヤーが少なすぎます');
      return;
    }
    
    // targetOffsetsが計算されていない場合は処理しない
    const targetOffsets = targetOffsetsRef.current;
    console.log('targetOffsets:', targetOffsets);
    if (targetOffsets.length === 0) {
      console.log('targetOffsetsが計算されていません');
      return;
    }
    
    // プレイヤーの中心点を計算
    const centerX = playerEntries.reduce((sum, p) => sum + p.graphic.x, 0) / playerEntries.length;
    const centerY = playerEntries.reduce((sum, p) => sum + p.graphic.y, 0) / playerEntries.length;
    console.log('プレイヤーの中心点:', { centerX, centerY });
    
    // 各プレイヤーの中心点からの相対位置を計算
    const playerPositions = playerEntries.map(p => ({
      player: p,
      shape: p.shape.shape,
      color: p.shape.color,
      dx: p.graphic.x - centerX,
      dy: p.graphic.y - centerY
    }));
    console.log('プレイヤーの相対位置:', playerPositions);
    
    // 各targetOffsetに対応するプレイヤーがいるか確認
    const matchResults = targetOffsets.map(target => {
      // 対応するプレイヤーを探す
      const matchingPlayer = playerPositions.find(p => {
        // 図形と色が一致するか確認
        const shapeMatch = p.shape === target.shape;
        const colorMatch = p.color === target.color;
        
        // 位置が近いか確認（許容誤差30px）
        const dx = Math.abs(p.dx - target.dx);
        const dy = Math.abs(p.dy - target.dy);
        const positionMatch = dx < 10 && dy < 10;
        
        console.log('判定:', {
          target,
          player: p,
          shapeMatch,
          colorMatch,
          dx,
          dy,
          positionMatch
        });
        
        return shapeMatch && colorMatch && positionMatch;
      });
      
      return !!matchingPlayer;
    });
    
    console.log('判定結果:', matchResults);
    
    // すべてのtargetOffsetに対応するプレイヤーが見つかった場合
    const allMatched = matchResults.every(result => result);
    console.log('すべて一致:', allMatched);
    
    if (allMatched) {
      setIsCleared(true);
      console.log("クリア！おめでとうございます！");
    }
  }

  const endGame = async () => {
    if (!taskToken) return;
    await client.queries.sendTaskSuccessSfn({ taskToken });
    router.push(`/`);
  };


  const gotoHome = async () => {
    if (!taskToken) return;
    await client.queries.sendTaskSuccessSfn({ taskToken });
    router.push(`/`);
  };


  return (
    <div>
      <h1>ゲーム画面</h1>
      <p>{lobby_id}</p>
      <h3>お手本</h3>
      <div ref={resultShapeRef}></div>
      <h3 className="mt-3">他のプレイヤーと協力してお手本と同じ図形を完成させましょう！</h3>
      方向キーで操作できます。
      <div ref={gameRef} style={{ marginTop: "10px", fontSize: "20px" }}></div>
      <button onClick={endGame} type="button" className="btn btn-success my-3">ゲームを終わる</button>

      {showWait && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-body">
                <p>他のプレイヤーの準備完了を待っています</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCleared && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-body">
                <h3>クリア！おめでとうございます！</h3>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    gotoHome();
                  }}
                >
                  ホーム画面に戻る
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
