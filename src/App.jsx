import { useState } from 'react'
import './App.css'

// シーン一覧（Game.htmlの構成に対応）
// map          : ワールドマップ（メイン画面）
// party        : 部隊・キャラクター管理
// attack_form  : 攻撃編成（AttackFormationScene）
// battle       : 戦闘（ActionScene + ResolveScene）
// save         : セーブ/ロード

function App() {
  const [scene, setScene] = useState('map')

  const navigate = (to, params = {}) => {
    console.log('[App] navigate:', to, params)
    setScene(to)
  }

  return (
    <div id="app-root">
      <p style={{ color: '#fff', padding: 20 }}>
        kiritan_r — React+Vite 移行中<br />
        現在のシーン: <strong>{scene}</strong>
      </p>
      <p style={{ color: '#888', padding: '0 20px', fontSize: 12 }}>
        ※ 画面遷移図の確定後に各シーンを実装します
      </p>
    </div>
  )
}

export default App
