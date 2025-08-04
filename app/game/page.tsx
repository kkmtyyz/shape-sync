'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { generateClient } from "aws-amplify/data";
import { getCurrentUser, GetCurrentUserOutput } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import type { Schema } from "@/amplify/data/resource";
import { events, type EventsChannel } from "aws-amplify/data";

const client = generateClient<Schema>();


export default function GamePage() {
  const searchParams = useSearchParams();
  const lobby_id = searchParams.get('id');
  const router = useRouter();
  const [user, setUser] = useState<GetCurrentUserOutput>();
  const [userLobby, setUserLobby] = useState<Array<Schema["UserLobby"]["type"]>>([]);
  const [isOwner, setIsOwner] = useState<Boolean>(false);
  const [myEvents, setMyEvents] = useState<Record<string, any>[]>([]);

  const getCurrentUserAsync = async () => {
    const result = await getCurrentUser();
    setUser(result);
  };

  useEffect(() => {
    getCurrentUserAsync();
  }, []);

  function draw() {
    let canvas = document.getElementById("myCanvas");
    let ctx = canvas?.getContext("2d");
    const shapes = myEvents.event.message;

    // 描画中心のオフセット (canvas 中心を (0, 0) にする)
    let offsetX = canvas.width / 2;
    let offsetY = canvas.height / 2;
    const size = 30;
    function drawShape(shape) {
      const { x, y, color, shape: type } = shape;
      let cx = offsetX + x;
      let cy = offsetY + y;

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
    }
    shapes.forEach(drawShape);

    // ユーザーのオブジェクトを描画
    const userShape = shapes.find(shape => shape.id == user?.userId);
    console.log("userId", user?.userId);
    console.log("userShape", userShape);
    canvas = document.getElementById("myCanvas2");
    ctx = canvas?.getContext("2d");
    offsetX = canvas.width / 2;
    offsetY = canvas.height / 2;
    let cx = offsetX;
    let cy = offsetY;
    ctx.fillStyle = userShape.color;
    if (userShape.shape === "square") {
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    } else if (userShape.shape === "circle") {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (userShape.shape === "triangle") {
      ctx.beginPath();
      ctx.moveTo(cx, cy - size / 2);
      ctx.lineTo(cx + size / 2, cy + size / 2);
      ctx.lineTo(cx - size / 2, cy + size / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  useEffect(() => {
    console.log('received', myEvents);
    if (myEvents.event?.message != null) {
      console.log(myEvents.event.message)
      draw();
      // answerとtaskTokenを変数としてセット
    }

    if (myEvents.event?.message == 'start_game') {
      const result = window.confirm("ゲームを開始してよろしいですか？"); // OK = true, キャンセル = false
      if (result) {
        console.log("Yesが選ばれました");
        console.log('token', myEvents.event?.taskToken);

        (async () => {
          const ret = await client.queries.sendTaskSuccessSfn({
            taskToken: myEvents.event.taskToken,
          });
          console.log(ret);
 
          router.push(`/game?id=${encodeURIComponent(lobby_id as string)}`);
        })();
      } else {
        console.log("Noが選ばれました");
      }
    }
  }, [myEvents]);

  useEffect(() => {
    if (user == null) {
      console.log('user is null');
      return;
    }

    let channel: EventsChannel;
    // チャネル `/default/<lobby_id>/<user_id>` のサブスクリプションを開始
    const connectAndSubscribe = async () => {
      const channel_name = '/default/' + lobby_id + '/' + user?.userId;
      console.log('channel_name', channel_name);
      //channel = await events.connect('/default/' + lobby_id + '/' + user?.userId);
      channel = await events.connect(channel_name);

      channel.subscribe({
        next: (data) => {
          //console.log('received', data);
          //setMyEvents((prev) => [data, ...prev]);
          setMyEvents(data);
        },
        error: (err) => console.error('error', err),
      });
    };

    connectAndSubscribe();

    return () => channel && channel.close();
  }, [user]);


  return (
    <div>
      <h1>Game</h1>
      <p>{lobby_id}</p>
      <h2>お手本</h2>
      <canvas
        id="myCanvas"
        width={500}
        height={500}
        style={{ backgroundColor: "white" }}
      ></canvas>
      <h2>あなたは</h2>
      <canvas
        id="myCanvas2"
        width={500}
        height={250}
        style={{ backgroundColor: "white" }}
      ></canvas>
      <button onClick={publishEvent}>準備完了</button>
    </div>
  );
}
