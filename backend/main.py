import os
import json
import base64
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import httpx 

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

# --- 配置 ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://api.gptsapi.net/v1") 
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash") # 即使是2.5也会兼容

# --- Prompt ---
STREAM_SYSTEM_PROMPT = """
你是一位严谨的学术教授。
请严格按照以下 Markdown 格式输出（不要使用 JSON，不要输出多余的寒暄）：

# 题目
(这里提取或复述题目)

# 深度解析
(这里进行详细推导，支持 LaTeX，例如 $E=mc^2$)

# 最终答案
(这里写最终结论)

# 标签
(标签1, 标签2, 标签3)
"""

class Question(BaseModel):
    text: str

# 🛠️ 客户端构造器 (与 test_api.py 保持一致)
def get_client():
    http_client = httpx.Client(trust_env=False) # 强制直连
    return OpenAI(
        api_key=GEMINI_API_KEY, 
        base_url=GEMINI_BASE_URL,
        timeout=120.0, 
        http_client=http_client
    )

# --- 纯文本提问接口 (非流式) ---
@app.post("/ask_ai")
async def ask_ai(question: Question):
    client = get_client()
    print(f"🤖 收到文本提问，正在思考 (Model: {GEMINI_MODEL})...")
    
    try:
        # ⚡️ stream=False (稳如老狗模式)
        completion = client.chat.completions.create(
            model=GEMINI_MODEL,
            messages=[
                {"role": "system", "content": STREAM_SYSTEM_PROMPT},
                {"role": "user", "content": question.text}
            ],
            stream=False, 
            temperature=0.7 
        )
        # 获取完整内容
        content = completion.choices[0].message.content
        print("✅ 思考完成，正在返回数据...")
        return Response(content=content, media_type="text/plain")

    except Exception as e:
        error_msg = f"System Error: {str(e)}"
        print(f"❌ 发生错误: {error_msg}")
        return Response(content=error_msg, media_type="text/plain")

# --- 图片分析接口 (非流式) ---
@app.post("/analyze_image")
async def analyze_image(text: str = Form(...), image: UploadFile = File(...)):
    print(f"📷 收到图片，正在上传并解析 (Model: {GEMINI_MODEL})...")
    
    image_content = await image.read()
    base64_image = base64.b64encode(image_content).decode('utf-8')
    media_type = image.content_type or "image/jpeg"

    client = get_client()

    try:
        # ⚡️ stream=False (稳如老狗模式)
        completion = client.chat.completions.create(
            model=GEMINI_MODEL, 
            messages=[
                {"role": "system", "content": STREAM_SYSTEM_PROMPT},
                {
                    "role": "user", 
                    "content": [
                        {"type": "text", "text": text},
                        {
                            "type": "image_url", 
                            "image_url": {
                                "url": f"data:{media_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            stream=False, 
            temperature=0.7
        )
        content = completion.choices[0].message.content
        print("✅ 解析完成，正在返回数据...")
        return Response(content=content, media_type="text/plain")

    except Exception as e:
        error_msg = f"System Error: {str(e)}"
        print(f"❌ 发生错误: {error_msg}")
        return Response(content=error_msg, media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    # 打印一下当前的配置，方便二次确认
    print(f"🚀 服务启动中...")
    print(f"Using Model: {GEMINI_MODEL}")
    uvicorn.run(app, host="0.0.0.0", port=8000)