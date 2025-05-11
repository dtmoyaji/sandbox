const http = require('http');

// バックエンドサーバーへの接続テスト
const testEndpoint = (url) => {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      console.log(`ステータスコード: ${res.statusCode}`);
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`レスポンス: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
        resolve({ success: true, status: res.statusCode, data });
      });
    });
    
    req.on('error', (error) => {
      console.error(`エラー: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    req.end();
  });
};

async function testConnections() {
  console.log('バックエンドサーバー接続テスト実行中...');
  
  // 設定確認
  console.log('環境変数設定:');
  console.log('- frontend/.env: VITE_API_URL=http://localhost:3031/api');
  console.log('- backend/.env: PORT=3001 (docker-compose.ymlで外部ポート3031にマッピング)');
  
  // ポート3031テスト
  console.log('\nポート3031テスト中...');
  const port3031Result = await testEndpoint('http://localhost:3031/');
  
  // APIエンドポイントテスト
  console.log('\nAPIエンドポイントテスト中...');
  const apiResult = await testEndpoint('http://localhost:3031/api');
  
  // 認証エンドポイントテスト
  console.log('\n認証エンドポイントテスト中...');
  const authResult = await testEndpoint('http://localhost:3031/auth/login');
  
  console.log('\nテスト結果サマリー:');
  console.log(`ポート3031: ${port3031Result.success ? '接続成功' : '接続失敗'} - ${port3031Result.error || port3031Result.status}`);
  console.log(`APIエンドポイント: ${apiResult.success ? '接続成功' : '接続失敗'} - ${apiResult.error || apiResult.status}`);
  console.log(`認証エンドポイント: ${authResult.success ? '接続成功' : '接続失敗'} - ${authResult.error || authResult.status}`);
}

testConnections();
