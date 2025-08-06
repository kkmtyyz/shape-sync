'use client';

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from 'next/navigation';
import { generateClient } from "aws-amplify/data";
import { FetchUserAttributesOutput, fetchUserAttributes } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import type { Schema } from "@/amplify/data/resource";
import { events, type EventsChannel } from "aws-amplify/data";

const client = generateClient<Schema>();

export default function LobbyPage() {
  const searchParams = useSearchParams();
  const user_id = searchParams.get('id');
  const lobby_id = searchParams.get('lobby_id');
  const router = useRouter();
  const [user, setUser] = useState<FetchUserAttributesOutput>();
  const [userLobby, setUserLobby] = useState<Array<Schema["UserLobby"]["type"]>>([]);
  const [isOwner, setIsOwner] = useState<Boolean>(false);
  const [personalMessage, setPersonalMessage] = useState<Record<string, any>[]>([]);
  const [lobbyMessage, setLobbyMessage] = useState<Record<string, any>[]>([]);
  const [lobby, setLobby] = useState<Schema["Lobby"]["type"]>();
  const [showConfirm, setShowConfirm] = useState(false);
  let connectionFlag = false;
  let readyFlag = useRef<Boolean>(false);

  // PersonalMessage処理
  useEffect(() => {
    console.log('received', personalMessage);
    if (personalMessage.event?.message == 'confirm_start_ready' && readyFlag.current == false) {
      readyFlag.current = true;
      setShowConfirm(true); // モーダル表示
      //const result = window.confirm("ゲームを開始してよろしいですか？"); // OK = true, キャンセル = false
      //if (result) {
      //  console.log("Yesが選ばれました");
      //  console.log('token', personalMessage.event?.taskToken);

      //  (async () => {
      //    const ret = await client.queries.sendTaskSuccessSfn({
      //      taskToken: personalMessage.event.taskToken,
      //    });
      //    console.log(ret);
      //  //alert('他のプレイヤーを待っています');
 
      //    //router.push(`/game?id=${user_id}&lobby_id=${encodeURIComponent(lobby_id)}`);
      //  })();
      //} else {
      //  console.log("Noが選ばれました");
      //}
    }
  }, [personalMessage]);

  // PersonalMessageサブスクライブ
  useEffect(() => {
    let channel: EventsChannel;
    const connectAndSubscribe = async () => {
      const channel_name = '/default/' + lobby_id + '/' + user_id;
      console.log('channel_name', channel_name);
      channel = await events.connect(channel_name);

      // チャネル `/default/<lobby_id>/<user_id>` のサブスクリプションを開始
      channel.subscribe({
        next: (data) => {
          setPersonalMessage(data);
        },
        error: (err) => console.error('error', err),
      });
    };

    connectAndSubscribe();

    return () => channel && channel.close();
  }, []);

  // LobbyMessage処理
  useEffect(() => {
    console.log('lobbyMessage', lobbyMessage);
    if (!lobbyMessage) return;
    if (lobbyMessage.event?.message == 'start_ready' && readyFlag.current == true) {
      router.push(`/ready?id=${user_id}&lobby_id=${encodeURIComponent(lobby_id)}`);
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


  async function publishEvent() {
    // Publish via HTTP POST
    //await events.post('default/channel', { some: 'data' });

    // Alternatively, publish events through the WebSocket channel
    const channel = await events.connect('default/channel');
    await channel.publish({ some: 'data2' });
  }

  const getCurrentUserAsync = async () => {
    const result = await fetchUserAttributes();
    setUser(result);
  };

  useEffect(() => {
    getCurrentUserAsync();
  }, []);

  /*
  function listUsers() {
    // ロビーに入ったらロビーにいるユーザーをサブスクライブ
    const subscription = client.models.UserLobby.observeQuery({
      filter: {
        lobby_id: {eq: lobby_id}
      }
    }).subscribe({
      next: (data) => setUserLobby([...data.items]),
    });
    return () => subscription.unsubscribe();
  }
  */

  useEffect(() => {
    if (!lobby_id) return;
     (async () => {
       const {data: users, } = await client.models.UserLobby.list({
          filter: {
            lobby_id: {eq: lobby_id}
          }
       });
       setUserLobby(users);
     })();
     console.log('users', userLobby);

    //listUsers();
    // ロビーに入ったらロビーにいるユーザーをサブスクライブ
    //const subscription = client.models.UserLobby.observeQuery({
    //const selectionSet = ['id', 'lobby_id', 'user_name'] as const;
    const subscription = client.models.UserLobby.onUpdate({
    //const subscription = client.models.UserLobby.observeQuery({
      filter: {
        lobby_id: {eq: lobby_id}
      }
      //selectionSet: ['id', 'lobby_id', 'user_name']
      //selectionSet: [...selectionSet]
    }).subscribe({
      //next: (data) => setUserLobby([...data.items]),
      //next: ({items, isSynced}) => {
      next: (data) => {
        console.log('data', data);
        //setUserLobby(data.items);
        setUserLobby(prev => [...prev, data]);
        //setUserLobby(items);
        //setUserLobby([...items])
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    console.log('lobby', lobby);
    if (lobby?.state == 'start_game') {
      router.push(`/game?id=${encodeURIComponent(lobby_id as string)}`);
}
  }, [lobby]);

  useEffect(() => {
    // ロビーに入ったらロビーの状態をサブスクライブ
    const subscription = client.models.Lobby.observeQuery({
      filter: {
        id: {eq: lobby_id}
      }
    }).subscribe({
      next: (data) => setLobby(data.items[0]),
    });
    return () => subscription.unsubscribe();
  }, []);

  const getIsOwnerIdAsync = async() => {
    const {data: lobby, errors} = await client.models.Lobby.get({ id: lobby_id });
    console.log(lobby);
    //console.log(user);
    //if (lobby?.owner === user?.sub) {
    if (lobby?.owner === user_id) {
      setIsOwner(true);
    }
  };

  useEffect(() => {
    getIsOwnerIdAsync()
  }, []);

  async function startGame() {
    console.log('check');
    const user_num = userLobby.length;
    const ret = await client.queries.startSfn({
      name: "Amplify",
      lobby_id: lobby_id
    })
    console.log(ret);
    console.log(user_num);
    //await events.post('default/channel', { some: 'start_game' });
  }

  function modalCallBack(res: boolean) {
    if (res) {
      console.log("Yesが選ばれました");
      console.log('token', personalMessage.event?.taskToken);
    
      (async () => {
        const ret = await client.queries.sendTaskSuccessSfn({
          taskToken: personalMessage.event.taskToken,
        });
        console.log(ret);
      //alert('他のプレイヤーを待っています');
    
        //router.push(`/game?id=${user_id}&lobby_id=${encodeURIComponent(lobby_id)}`);
      })();
    } else {
      console.log("Noが選ばれました");
    }
  }

  return (
    <div>
      <h1>Lobby: </h1>
      <p>{lobby_id}</p>
      <div className="mt-5">参加中のユーザー</div>
      <ul className="list-group mt-3">
        {userLobby.map(item => (
          <li key={item.id} className="list-group-item list-group-item-light">{item.user_name}</li>
        ))}
      </ul>
      <button onClick={startGame} type="button" className="btn btn-success w-100 my-3" disabled={!isOwner}>Start Game</button>
      <button onClick={publishEvent} type="button" className="btn" disabled={!isOwner}>Publish Event</button>

      {showConfirm && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-body">
                <p>ゲームを開始してもいいですか？</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowConfirm(false);
                    modalCallBack(false);
                  }}
                >
                  No
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setShowConfirm(false);
                    modalCallBack(true);
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

