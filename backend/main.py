import os
import json
import re
import base64
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

# 1. 加载环境变量 (读取 .env 文件)
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

class Question(BaseModel):
    text: str

# 3. 读取密钥 (安全版)
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL")
SILICON_API_KEY = os.getenv("SILICON_API_KEY")
SILICON_BASE_URL = os.getenv("SILICON_BASE_URL")
SILICON_VISION_MODEL = os.getenv("SILICON_VISION_MODEL")

# --- 新增工具函数：清洗 AI 返回的 JSON ---
def clean_json_response(content: str):
    """
    不管 AI 返回什么，都尽力提取出 JSON 对象
    """
    try:
        # 情况A：AI 很听话，直接给了 JSON
        return json.loads(content)
    except json.JSONDecodeError:
        # 情况B：AI 加了 Markdown 标记 (```json ... ```)
        match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except:
                pass
        # 情况C：彻底失败，做个兜底
        return {
            "title": "AI解析结果 (非标准格式)",
            "analysis": content,
            "tags": []
        }

@app.post("/ask_ai")
def ask_ai(question: Question):
    """纯文字模式 (DeepSeek)"""
    try:
        client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个专业的软件工程导师。"},
                {"role": "user", "content": question.text}
            ],
            stream=False
        )
        return {"answer": response.choices[0].message.content}
    except Exception as e:
        print(f"DeepSeek Error: {e}")
        return {"error": str(e)}

@app.post("/analyze_image")
async def analyze_image(text: str = Form(...), image: UploadFile = File(...)):
    """图片模式 (Qwen-VL) - 返回结构化 JSON"""
    try:
        image_content = await image.read()
        base64_image = base64.b64encode(image_content).decode('utf-8')
        
        client = OpenAI(api_key=SILICON_API_KEY, base_url=SILICON_BASE_URL)

        response = client.chat.completions.create(
            model=SILICON_VISION_MODEL, 
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                    ],
                }
            ],
            stream=False
        )
        
        # 关键修改：清洗数据，返回 JSON 对象
        raw_content = response.choices[0].message.content
        cleaned_data = clean_json_response(raw_content)
        return cleaned_data 

    except Exception as e:
        print(f"Qwen Error: {e}")
        return {"error": str(e), "analysis": "识别服务出错", "title": "错误"}