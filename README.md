# AWS上に構築するマルチクライアント状態同期とリアルタイム通信を使用したオンラインゲーム

**プレイヤーごとにランダムな色と形の図形を割り当て、協力してお手本と同じ図形を完成させるゲームです。**
**AWS StepFunctionsとAWS AppSyncを使用したサーバーレスなオンラインゲームシステムです。**
**プレイヤーの状態を同期しつつ、リアルタイムに互いの状態を共有します。**

次のような特徴があります。

- Amazon Cognitoを使用したユーザー認証
- AWS StepFunctionsタスクトークンを使用したマルチクライアント状態同期
- AWS AppSync Eventsを使用したWebSocketによるマルチクライアント間リアルタイム通信
- AWS Amplify Gen2によるフロントエンドとバックエンドの効率的な開発

ブログ記事「[AWSで実現するマルチクライアント状態同期とリアルタイム](https://kkmtyyz.hatenablog.com/entry/2025/09/12/120750)」にて詳しく解説しています。

## プレイ動画
[AWS Step FunctionsとAppSync Eventsで構築したオンラインゲーム 解説付きプレイ動画](https://www.docswell.com/s/kkmtyyz/vPNWVM5-2025-08-10-5892#)


## 動作イメージ
- 実際にはロビー画面やレディー画面などもあります。

- プレイ画面
<p align="center">
  <img src="./readme_img/game.png" width="600">
</p>

- 状態同期
<p align="center">
  <img src="./readme_img/realtime_state_sync_1.png" width="600">
  <img src="./readme_img/realtime_state_sync_2.png" width="600">
</p>

## アーキテクチャ図

<p align="center">
  <img src="./readme_img/arch.png" width="800">
</p>

## デプロイ方法

- AWS CDKにて`cdk bootstrap`が完了している必要があります
- Amplify CI/CDでデプロイ。サンドボックスの場合は `$ npx ampx sandbox` を実行

## License
[MIT](./LICENSE-MIT)


