import { Handler } from "aws-lambda";


type InputUser = {
  id: string;
};

// ユーザーごとの図形・色・初期座標を持つ
type PlacedUser = {
  id: string;
  shape: string;
  color: string;
  x: number;
  y: number;
};

/**
 * ユーザーをランダムに隣り合わせて配置する関数
 * 最初のユーザーの座標を0, 0とし、以降のユーザーを上下左右どこかに隣接するよう配置する
 */
function generateIrregularPattern(users: InputUser[]): PlacedUser[] {
  // 1マスのサイズ（正方形）。ピクセル単位
  const SIZE = 40;

  // 上下左右を表す2次元配列
  const directions: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  // 使用済みの座標を管理するセット
  // "x,y" 形式の文字列で持つ
  const usedPositions = new Set<string>();
  // 配置済みユーザーを持つ
  const placedUsers: PlacedUser[] = [];

  // 図形の種類
  const shapes = ["square", "triangle", "circle"];

  // ユーザー数分の色をランダムに作る
  const colors: string[] = [];
  while (colors.length < users.length) {
    const color =
      "#" +
      Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0");

    // 既存の色と重複しない場合のみ追加
    if (!colors.includes(color)) {
      colors.push(color);
    }
  }

  // 最初のユーザー
  const first: PlacedUser = {
    id: users[0].id,
    shape: shapes[0 % shapes.length],
    color: colors[0 % colors.length],
    x: 0,
    y: 0,
  };

  placedUsers.push(first);
  usedPositions.add("0,0");

  // 2人目以降のユーザーを配置する
  for (let i = 1; i < users.length; i++) {
    let placed = false;

    // 配置が成功するまでループ
    while (!placed) {
      // 隣接するユーザーをランダムに選ぶ
      const base: PlacedUser =
        placedUsers[Math.floor(Math.random() * placedUsers.length)];

      // 隣接方向として、上下左右をランダムに並びかえる
      const shuffledDirs = [...directions].sort(
        () => Math.random() - 0.5
      );

      // 隣接できる方向になるまでループ
      for (const [dx, dy] of shuffledDirs) {
        // マスの座標を計算
        const nx: number = base.x / SIZE + dx;
        const ny: number = base.y / SIZE + dy;
        const key = `${nx},${ny}`;

        // まだ使われてない座標なら配置する
        if (!usedPositions.has(key)) {
          usedPositions.add(key);

          const newUser: PlacedUser = {
            id: users[i].id,
            shape: shapes[i % shapes.length],
            color: colors[i % colors.length],
            x: nx * SIZE,
            y: ny * SIZE,
          };

          placedUsers.push(newUser);
          placed = true;
          break;
        }
      }
    }
  }

  return placedUsers;
}

export const handler: Handler = async (event) => {
  const { userIds } = event;

  console.log(userIds);

  const answer = generateIrregularPattern(userIds);

  console.log(answer);

  return { answer };
};

