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
    // 尝试导入 @xiee/zdict 包
    const zdictModule = await import('@xiee/zdict/js/zdict.js');

    // 获取数据（可能是 default 导出或直接导出）
    const data = zdictModule.default || zdictModule;

    if (data && typeof data === 'object') {
      return data;
    }

    throw new Error('无法从 npm 包中提取数据');
  } catch (error) {
    console.log('从 npm 包加载失败，尝试从文件系统读取...');

    // 尝试从 node_modules 直接读取（尝试多个可能的文件名）
    const possibleFiles = [
      path.join(__dirname, '../node_modules/@xiee/zdict/js/zdict.js'),
      path.join(__dirname, '../node_modules/@xiee/zdict/js/data-chars.js'),
    ];

    let nodeModulesPath = null;
    for (const filePath of possibleFiles) {
      if (fs.existsSync(filePath)) {
        nodeModulesPath = filePath;
        break;
      }
    }

    if (!nodeModulesPath) {
      throw new Error('npm 包未安装或数据文件不存在');
    }

    try {
      // 读取文件内容
      const fileContent = fs.readFileSync(nodeModulesPath, 'utf8');

      // 这是一个 UMD 模块，需要执行 factory 函数
      // 创建一个模拟的 module 环境
      const module = { exports: {} };
      const exports = module.exports;

      // 执行 UMD 包装的代码
      // 这会设置 module.exports
      eval(fileContent);

      // 如果 module.exports 是一个函数（factory），调用它
      if (typeof module.exports === 'function') {
        return module.exports();
      }

      // 如果 module.exports 是对象，直接返回
      if (typeof module.exports === 'object' && module.exports !== null) {
        // 检查是否有 chars 属性（zdict.js 的数据结构）
        if (module.exports.chars) {
          return module.exports.chars;
        }
        return module.exports;
      }

      throw new Error('无法解析模块格式');
    } catch (e) {
      throw new Error(`读取文件失败: ${e.message}`);
    }
  }

  throw new Error('npm 包未安装或数据文件不存在');
}

// 转换数据格式（确保符合我们的接口）
// zdict.js 的数据格式是: { "一": { "yī": ["释义1", "释义2", ...] } }
function convertDataFormat(data) {
  const result = {};

  for (const [char, entry] of Object.entries(data)) {
    if (typeof entry === 'object' && entry !== null) {
      // zdict.js 格式：entry 是一个对象，键是拼音，值是释义数组
      let definitions = [];
      let pinyins = [];

      // 收集所有拼音和释义
      for (const [py, defs] of Object.entries(entry)) {
        if (Array.isArray(defs)) {
          definitions.push(...defs);
          // 收集所有拼音
          if (!pinyins.includes(py)) {
            pinyins.push(py);
          }
        }
      }

      // 标准化数据格式
      result[char] = {
        definition: definitions[0] || '',
        definitions: definitions,
        words: [], // zdict.js 不包含组词，需要从其他地方获取
        组词: [],
        examples: [],
        pinyin: pinyins.length > 1 ? pinyins : (pinyins[0] || '')
      };
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
