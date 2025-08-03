'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { generateClient } from "aws-amplify/data";
import { getCurrentUser, GetCurrentUserOutput } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import type { Schema } from "@/amplify/data/resource";
import { events, type EventsChannel } from "aws-amplify/data";

const client = generateClient<Schema>();

export default function LobbyPage() {
  const searchParams = useSearchParams();
  const lobby_id = searchParams.get('id');
  const router = useRouter();
  const [user, setUser] = useState<GetCurrentUserOutput>();
  const [userLobby, setUserLobby] = useState<Array<Schema["UserLobby"]["type"]>>([]);
  const [isOwner, setIsOwner] = useState<Boolean>(false);
  const [myEvents, setMyEvents] = useState<Record<string, any>[]>([]);

  useEffect(() => {
    console.log('received', myEvents);
    if (myEvents.event?.some == 'start_game') {
      router.push(`/game?id=${encodeURIComponent(lobby_id as string)}`);
}
  }, [myEvents]);

  useEffect(() => {
    let channel: EventsChannel;

    const connectAndSubscribe = async () => {
      channel = await events.connect('/default/channel');

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
  }, []);

  async function publishEvent() {
    // Publish via HTTP POST
    //await events.post('default/channel', { some: 'data' });

    // Alternatively, publish events through the WebSocket channel
    const channel = await events.connect('default/channel');
    await channel.publish({ some: 'data2' });
  }

  const getCurrentUserAsync = async () => {
    const result = await getCurrentUser();
    setUser(result);
  };

  useEffect(() => {
    getCurrentUserAsync();
  }, []);

  function listUsers() {
    client.models.UserLobby.observeQuery({
      filter: {
        lobby_id: {eq: lobby_id}
      }
    }).subscribe({
      next: (data) => setUserLobby([...data.items]),
    });
  }

  useEffect(() => {
    listUsers();
  }, []);

  const getIsOwnerIdAsync = async() => {
    const {data: lobby, errors} = await client.models.Lobby.get({ id: lobby_id });
    console.log(lobby);
    console.log(user);
    if (lobby?.owner === user?.userId) {
      setIsOwner(true);
    }
  };

  useEffect(() => {
    getIsOwnerIdAsync()
  }, [user]);

  async function startGame() {
    console.log('check');
    const user_num = userLobby.length;
    const ret = client.queries.startSfn({
      name: "Amplify",
    })
    console.log(ret);
    console.log(user_num);
    //await events.post('default/channel', { some: 'start_game' });
  }

  return (
    <div>
      <h1>Lobby</h1>
      <p>{lobby_id}</p>
      <button onClick={startGame} disabled={!isOwner}>Start Game</button>
      <button onClick={publishEvent} disabled={!isOwner}>Publish Event</button>
      <ul>
        {userLobby.map((user) => (
          <li key={user.id}>{user.id}</li>
        ))}
      </ul>
    </div>
  );
}

