"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { FetchUserAttributesOutput, fetchUserAttributes } from 'aws-amplify/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from 'react-bootstrap/Button';

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {
  const [user, setUser] = useState<FetchUserAttributesOutput>();
  const [lobbies, setLobbies] = useState<Array<Schema["Lobby"]["type"]>>([]);
  const { signOut } = useAuthenticator();
  const router = useRouter();

  const getCurrentUserAsync = async () => {
    const result = await fetchUserAttributes();
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
      owner: user?.sub
    });
  }


  async function initUserLobby() {
    const { data: userLobby, errors } = await client.models.UserLobby.get({
      id: user?.sub as string
    });
    console.log('initUserLobby()');
    console.log('userLobby', userLobby);
    if (userLobby != null) {
      client.models.UserLobby.update({
        id: user?.sub as string,
        lobby_id: null
      });
    } else {
      client.models.UserLobby.create({
        id: user?.sub as string,
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
    console.log('enterLobby');
    const selectionSet = ['id', 'lobby_id', 'user_name'] as const;
    await client.models.UserLobby.update({
      id: user?.sub as string,
      lobby_id: lobby_id,
      user_name: user?.preferred_username,
    });

    router.push(`/lobby?id=${user?.sub}&lobby_id=${encodeURIComponent(lobby_id)}`);
  }

  return (
    <main>
      <h2 className="mt-3">Shape Sync へようこそ！</h2>
      <h4 className="mt-5">参加するロビーを選択してください</h4>
      <div className="list-group mt-3">
        {lobbies.map((lobby) => (
          <button
            key={lobby.id}
            type="button"
            className="list-group-item list-group-item-action list-group-item-success"
            onClick={() => enterLobby(lobby.id)}
          >
            {lobby.name} : {lobby.id}
          </button>
        ))}
      </div>
      <button onClick={createLobby} type="button" className="btn btn-secondary w-100 mb-3">+ Create Lobby</button>
      <button onClick={signOut} type="button" className="btn btn-secondary my-3">Sign out</button>
    </main>
  );
}
