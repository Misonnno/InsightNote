import os
import json
import re
import base64
import sqlite3
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from typing import List, Optional

# 1. 加载环境变量
load_dotenv()

app = FastAPI()

# 2. 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 数据库初始化 (自动创建一个 mistakes.db 文件)
DB_NAME = "mistakes.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # 创建错题表
    c.execute('''CREATE TABLE IF NOT EXISTS mistakes
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT,
                  answer TEXT,
                  analysis TEXT,
                  tags TEXT,
                  created_at TEXT)''')
    conn.commit()
    conn.close()

# 启动时初始化数据库
init_db()

# --- 模型定义 ---
class Question(BaseModel):
    text: str

class ReviewItem(BaseModel):
    title: str
    answer: str
    analysis: str
    tags: List[str] = []

# --- 配置密钥 ---
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

SILICON_API_KEY = os.getenv("SILICON_API_KEY")
SILICON_BASE_URL = os.getenv("SILICON_BASE_URL", "https://api.siliconflow.cn/v1")
SILICON_VISION_MODEL = os.getenv("SILICON_VISION_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct") 

# --- 工具函数：JSON 清洗 ---
def clean_json_response(content: str):
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    try:
        match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        json_str = match.group(1) if match else content
        # 修复 LaTeX 反斜杠
        json_str = json_str.replace('\\', '\\\\').replace('\\\\\\\\', '\\\\') 
        start = json_str.find('{')
        end = json_str.rfind('}')
        if start != -1 and end != -1:
            return json.loads(json_str[start:end+1])
    except Exception as e:
        print(f"JSON Repair Failed: {e}")

    return {
        "title": "解析结果 (自动修复)",
        "conclusion": "请查看下方详细解析",
        "analysis": content,
        "tags": ["AI解析"]
    }

# ===========================
# 🚀 模块 A：AI 智能解析接口
# ===========================

@app.post("/ask_ai")
def ask_ai(question: Question):
    try:
        client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
        system_prompt = """
        你是一位严谨的学术教授。
        【要求】：
        1. 先进行深度解析(analysis)，再得出结论(conclusion)。
        2. JSON字符串中 LaTeX 反斜杠必须转义 (例如 \\\\frac)。
        """
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question.text}
            ],
            stream=False,
            response_format={ "type": "json_object" } 
        )
        return clean_json_response(response.choices[0].message.content)
    except Exception as e:
        print(f"DeepSeek Error: {e}")
        return {"error": str(e)}

@app.post("/analyze_image")
async def analyze_image(text: str = Form(...), image: UploadFile = File(...)):
    try:
        image_content = await image.read()
        base64_image = base64.b64encode(image_content).decode('utf-8')

        # Step 1: Qwen (眼)
        client_vision = OpenAI(api_key=SILICON_API_KEY, base_url=SILICON_BASE_URL)
        ocr_prompt = """
        你是一个数据提取专家。
        1. 【文本提取】：提取所有题目文字。
        2. 【表格提取】：⚠️ 务必逐行读取表格数据，不要遗漏。
        3. 【视觉描述】：描述几何或拓扑结构。
        """
        vision_response = client_vision.chat.completions.create(
            model=SILICON_VISION_MODEL, 
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": ocr_prompt}, 
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                    ],
                }
            ],
            stream=False,
            temperature=0.01,
        )
        visual_context = vision_response.choices[0].message.content

        # Step 2: DeepSeek (脑)
        client_logic = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
        final_system_prompt = """
        你是一位严谨的教授。
        【JSON 格式 (顺序重要)】：
        {
          "title": "OCR题目文本",
          "analysis": "详细解析（先写这里，支持LaTeX）",
          "conclusion": "最终答案（最后写这里）",
          "tags": ["知识点"]
        }
        ⚠️ JSON 中 LaTeX 反斜杠必须双写 (\\\\times)。
        """
        full_query = f"【视觉信息】:\n{visual_context}\n【用户指令】:\n{text}"
        
        logic_response = client_logic.chat.completions.create(
            model="deepseek-chat", 
            messages=[
                {"role": "system", "content": final_system_prompt},
                {"role": "user", "content": full_query}
            ],
            stream=False,
            response_format={ "type": "json_object" }
        )
        return clean_json_response(logic_response.choices[0].message.content)

    except Exception as e:
        print(f"Error: {e}")
        return {"title": "Error", "conclusion": "系统异常", "analysis": str(e), "tags": ["Error"]}

# ===========================
# 📚 模块 B：错题本数据库接口 (修复了这里！)
# ===========================

# 1. 添加错题
@app.post("/review/add")
def add_review(item: ReviewItem):
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        # 将 tags 列表转为字符串存储
        tags_str = json.dumps(item.tags, ensure_ascii=False)
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        c.execute("INSERT INTO mistakes (title, answer, analysis, tags, created_at) VALUES (?, ?, ?, ?, ?)",
                  (item.title, item.answer, item.analysis, tags_str, created_at))
        conn.commit()
        conn.close()
        print(f"✅ 成功保存错题: {item.title[:10]}...")
        return {"status": "success", "message": "Saved successfully"}
    except Exception as e:
        print(f"❌ 保存失败: {e}")
        return {"status": "error", "message": str(e)}

# 2. 获取错题列表 (前端 Review 页面会用到)
@app.get("/review/list")
def get_reviews():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row # 让结果可以通过列名访问
    c = conn.cursor()
    c.execute("SELECT * FROM mistakes ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "title": row["title"],
            "answer": row["answer"],
            "analysis": row["analysis"],
            "tags": json.loads(row["tags"]) if row["tags"] else [],
            "created_at": row["created_at"]
        })
    return results

# 3. 删除错题
@app.delete("/review/delete/{item_id}")
def delete_review(item_id: int):
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("DELETE FROM mistakes WHERE id = ?", (item_id,))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)