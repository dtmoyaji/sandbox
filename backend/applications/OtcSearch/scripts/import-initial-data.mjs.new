import csv from 'csv-parser';
import fs from 'fs';
import iconv from 'iconv-lite';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModelManager } from '../../../controllers/model-manager.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

// スクリプト関数の定義
async function importInitialData() {
    console.log('OtcSearch初期データのインポートを開始します');
    
    try {
        // ModelManagerの初期化
        const modelManager = new ModelManager();
        await modelManager.reloadModels();
        
        // アプリケーション情報の取得
        const appInfo = JSON.parse(fs.readFileSync(
            path.resolve(__dirname, '../application.json'),
            'utf8'
        ));
        
        // productテーブルの取得
        const productTable = await modelManager.getModel('product');
        if (!productTable) {
            throw new Error('productテーブルが見つかりません');
        }
        
        // CSVファイルの読み込みと処理
        const csvFiles = [
            '100rec_セルフメディケーション対象品_スイッチ.csv',
            'セルフメディケーション対象品_スイッチ.csv',
            'セルフメディケーション対象品_非スイッチ.csv'
        ];
        
        for (const csvFile of csvFiles) {
            const filePath = path.resolve(rootDir, 'tmp', csvFile);
            if (!fs.existsSync(filePath)) {
                console.log(`ファイルが見つかりません: ${csvFile}`);
                continue;
            }
            
            console.log(`CSVファイルを処理中: ${csvFile}`);
            
            // CSVファイルをShift-JISとして読み込み
            const results = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(iconv.decodeStream('Shift_JIS'))
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', resolve)
                    .on('error', reject);
            });
            
            // データの整形と登録
            for (const row of results) {
                const isSwitch = csvFile.includes('スイッチ') && !csvFile.includes('非スイッチ');
                
                // JANコードの正規化
                let janCode = row['JANコード'] || row['JAN'] || '';
                janCode = janCode.replace(/[^0-9]/g, '');
                if (!janCode) continue;
                
                const productData = {
                    jan_code: janCode,
                    product_name: row['製品名'] || row['商品名'] || '',
                    product_category: row['薬効分類'] || '一般',
                    is_switch_otc: isSwitch,
                    ingredients: row['成分'] || '',
                    effects: row['効能・効果'] || '',
                    usage_instructions: row['用法・用量'] || '',
                    precautions: row['使用上の注意'] || '',
                    price: parseInt(row['価格'] || '0', 10) || 0,
                    stock_quantity: 10, // デフォルト在庫数
                };
                
                try {
                    await productTable.put(productData);
                    console.log(`商品を登録しました: ${productData.product_name}`);
                } catch (error) {
                    if (error.message.includes('unique')) {
                        console.log(`商品は既に存在します: ${productData.product_name}`);
                    } else {
                        console.error(`商品の登録に失敗しました: ${productData.product_name}`, error);
                    }
                }
            }
            
            console.log(`CSVファイルの処理が完了しました: ${csvFile}`);
        }
        
        console.log('初期データのインポートが完了しました');
        
    } catch (error) {
        console.error('初期データのインポート中にエラーが発生しました:', error);
        throw error;
    }
}

// スクリプト実行
importInitialData().catch(console.error);

// スクリプト登録情報
const scriptInfo = {
    script_name: 'import_initial_data',
    bind_module: {},
    parameters: [],
    description: 'OtcSearch アプリケーションの初期データをインポートするスクリプト',
    script: importInitialData.toString()
};

// エクスポート
export default scriptInfo;
