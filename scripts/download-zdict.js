#!/usr/bin/env node

/**
 * 从已安装的 @xiee/zdict 包中提取数据并转换为 JSON 格式
 * 
 * 数据来源说明：
 * - GitHub 仓库：https://github.com/yihui/zdict.js
 * - npm 包：@xiee/zdict (由 Yihui Xie 发布，与 GitHub 仓库相同)
 * 
 * 使用方法：
 *   node scripts/download-zdict.js
 * 
 * 或者使用 npm script：
 *   npm run download-zdict
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, '../public/zdict-data.json');

// 尝试从 npm 包加载数据
async function loadFromNpmPackage() {
  try {
    // 1. 优先尝试加载 @xiee/zdict
    // 注意：zdict 的主入口导出的默认对象包含 { chars, freqs }
    // 我们需要的是 chars
    const zdictModule = await import('@xiee/zdict/js/zdict.js');
    const data = zdictModule.default || zdictModule;

    if (data && data.chars) {
      return data.chars;
    }

    // 如果没有 chars 属性，可能是直接加载了 data-chars.js?
    // 或者是 zdict.js 结构不同
    if (data && typeof data === 'object') {
      // 检查是否看起来像 chars 数据 (key 是汉字, value 是对象)
      const keys = Object.keys(data);
      if (keys.length > 500 && data["一"]) {
        return data;
      }
    }

    throw new Error('npm 包导出格式不符合预期');
  } catch (error) {
    console.log(`从 npm 包导入失败 (${error.message})，尝试从文件系统读取...`);

    // 2. 尝试从 node_modules 直接读取 data-chars.js
    // zdict.js 可能会做合并，我们直接读取原始数据文件更安全
    const possibleFiles = [
      path.join(__dirname, '../node_modules/@xiee/zdict/js/data-chars.js'),
      path.join(__dirname, '../node_modules/@xiee/zdict/js/zdict.js'),
    ];

    let nodeModulesPath = null;
    for (const filePath of possibleFiles) {
      if (fs.existsSync(filePath)) {
        nodeModulesPath = filePath;
        console.log(`找到文件: ${filePath}`);
        break;
      }
    }

    if (!nodeModulesPath) {
      throw new Error('npm 包未安装或数据文件不存在');
    }

    try {
      // 读取文件内容
      const fileContent = fs.readFileSync(nodeModulesPath, 'utf8');

      // 处理 export default
      let jsonContent = fileContent;
      if (jsonContent.includes('export default')) {
        jsonContent = jsonContent.replace('export default', 'module.exports =');
      }

      // 创建模拟环境
      const module = { exports: {} };
      const exports = module.exports;

      // 简单 eval
      // 注意：data-chars.js 可能引用其他文件？不，它通常是纯数据
      // zdict.js 引用 imports，eval 会失败。所以优先找 data-chars.js
      try {
        eval(jsonContent);
      } catch (evalError) {
        // 如果是 zdict.js 含有 import 语句，eval 会挂
        // 我们只能希望 node_modules 里有 data-chars.js
        if (nodeModulesPath.endsWith('zdict.js')) {
          throw new Error('无法直接解析 zdict.js (可能包含 import), 请确保 data-chars.js 存在');
        }
        throw evalError;
      }

      let result = module.exports;
      if (typeof result === 'function') result = result();

      // 如果是 zdict.js 结构
      if (result.chars) return result.chars;

      // 如果直接是数据
      return result;

    } catch (e) {
      throw new Error(`读取/解析文件失败: ${e.message}`);
    }
  }
}

// 转换数据格式（确保符合新的接口：Char -> Pinyin -> Definitions[]）
// zdict.js 的原始数据格式已经是: { "一": { "yī": ["释义1", "释义2", ...] } }
// 我们只需要保留这个结构，不需要展平
function convertDataFormat(data) {
  const result = {};

  for (const [char, entry] of Object.entries(data)) {
    if (typeof entry === 'object' && entry !== null) {
      // 直接保留原始结构：{ "yī": ["..."] }
      result[char] = entry;
    }
  }

  return result;
}

// 主函数
async function main() {
  console.log('开始提取 zdict 数据...');

  try {
    // 从 npm 包加载数据
    const rawData = await loadFromNpmPackage();
    console.log('数据加载成功，开始转换格式...');

    // zdict.js 返回的是 { chars, freqs }，我们需要提取 chars
    const charsData = rawData.chars || rawData;

    // 转换数据格式
    const jsonData = convertDataFormat(charsData);

    // 确保输出目录存在
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 保存为 JSON
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(jsonData, null, 2), 'utf8');

    const dataSize = Object.keys(jsonData).length;
    console.log(`✅ 成功！已保存 ${dataSize} 个汉字数据到: ${OUTPUT_PATH}`);
    console.log('\n现在可以重新启动应用，zdict 数据将被自动加载。');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error('\n提示:');
    console.error('1. 确保已安装 @xiee/zdict: npm install @xiee/zdict');
    console.error('   (注意：@xiee/zdict 就是 https://github.com/yihui/zdict.js 的 npm 版本)');
    console.error('2. 或者手动从 https://github.com/yihui/zdict.js 下载 js/zdict.js 文件');
    console.error('3. 将数据转换为 JSON 格式并保存到 public/zdict-data.json');
    process.exit(1);
  }
}

// 运行
main();
