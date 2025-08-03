'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';

export default function GamePage() {
  const searchParams = useSearchParams();
  const lobby_id = searchParams.get('id');

  return (
    <div>
      <h1>Game</h1>
      <p>{lobby_id}</p>
    </div>
  );
}
