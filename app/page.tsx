"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { getCurrentUser, GetCurrentUserOutput } from 'aws-amplify/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {
  const [user, setUser] = useState<GetCurrentUserOutput>();
  const [lobbies, setLobbies] = useState<Array<Schema["Lobby"]["type"]>>([]);
  const { signOut } = useAuthenticator();
  const router = useRouter();

  const getCurrentUserAsync = async () => {
    const result = await getCurrentUser();
    setUser(result);
  };

  useEffect(() => {
    getCurrentUserAsync();
  }, []);

  function listLobbies() {
    client.models.Lobby.observeQuery().subscribe({
      next: (data) => setLobbies([...data.items]),
    });
  }

  useEffect(() => {
    listLobbies();
  }, []);

  function createLobby() {
    client.models.Lobby.create({
      name: window.prompt("Lobby name"),
      owner: user?.userId
    });
  }


  async function initUserLobby() {
    const { data: userLobby, errors } = await client.models.UserLobby.get({
      id: user?.userId as string
    });
    console.log('initUserLobby()');
    console.log('userLobby', userLobby);
    if (userLobby != null) {
      client.models.UserLobby.update({
        id: user?.userId as string,
        lobby_id: null
      });
    } else {
      client.models.UserLobby.create({
        id: user?.userId as string,
        lobby_id: null
      });
    }
  }

  useEffect(() => {
    if (user != null) {
      initUserLobby();
    }
  }, [user]);

  async function enterLobby(lobby_id: string) {
    //const { data: userLobby, errors } = await client.models.UserLobby.get({
    //  id: user?.userId as string
    //});
    console.log('enterLobby');
    //console.log('userLobby', userLobby);
    client.models.UserLobby.update({
      id: user?.userId as string,
      lobby_id: lobby_id
    });

    router.push(`/lobby?id=${encodeURIComponent(lobby_id)}`);
  }

  return (
    <main>
      <h1>Home</h1>
      <h2>{user?.userId}</h2>
      <button onClick={createLobby}>Create Lobby</button>
      <ul>
        {lobbies.map((lobby) => (
          <li key={lobby.id}>{lobby.name} : {lobby.id}<button onClick={() => enterLobby(lobby.id)}>参加</button></li>
        ))}
      </ul>
      <button onClick={signOut}>Sign out</button>
    </main>
  );
}
