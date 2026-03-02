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
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# --- 基础 Prompt ---
BASE_SYSTEM_PROMPT = """
你是一位严谨的学术教授。
请严格按照以下 Markdown 格式输出（不要使用 JSON，不要输出多余的寒暄）：

# 题目
(这里提取或复述题目)

# 深度解析
(这里进行详细推导，支持 LaTeX，例如 $E=mc^2$)

# 最终答案
(这里写最终结论)

# 标签
(在这里输出 1-3 个标签，用逗号分隔)
"""

# 🛠️ 接收前端传来的问题和已有标签
class Question(BaseModel):
    text: str
    existing_tags: str = "" 

# 🛠️ 客户端构造器
def get_client():
    http_client = httpx.Client(trust_env=False) 
    return OpenAI(
        api_key=GEMINI_API_KEY, 
        base_url=GEMINI_BASE_URL,
        timeout=120.0, 
        http_client=http_client
    )

# 🛠️ 动态构建 Prompt
def build_dynamic_prompt(existing_tags: str):
    prompt = BASE_SYSTEM_PROMPT
    if existing_tags:
        print(f"🔍 [Debug] 接收到前端传来的历史标签: {existing_tags}")
        prompt += f"\n\n【重要指令：标签生成规范】\n当前错题本中已存在的标签库有：[{existing_tags}]。\n请绝对优先从上述标签库中选择最匹配的标签！严禁随意创造同义词！如果完全不匹配才可使用新标签。"
    else:
        prompt += "\n\n【重要指令：标签生成规范】\n请使用最标准、简短的学科词汇（如：高等数学，数据结构等）作为标签。"
    return prompt

# --- 纯文本提问接口 ---
@app.post("/ask_ai")
async def ask_ai(question: Question):
    client = get_client()
    dynamic_prompt = build_dynamic_prompt(question.existing_tags)
    print(f"🤖 收到文本提问，正在思考 (Model: {GEMINI_MODEL})...")
    
    try:
        completion = client.chat.completions.create(
            model=GEMINI_MODEL,
            messages=[
                {"role": "system", "content": dynamic_prompt},
                {"role": "user", "content": question.text}
            ],
            stream=False, 
            temperature=0.1 # 极低温度，确保标签稳定
        )
        content = completion.choices[0].message.content
        print("✅ 思考完成，正在返回数据...")
        return Response(content=content, media_type="text/plain")

    except Exception as e:
        error_msg = f"System Error: {str(e)}"
        print(f"❌ 发生错误: {error_msg}")
        return Response(content=error_msg, media_type="text/plain")

# --- 图片分析接口 ---
@app.post("/analyze_image")
async def analyze_image(
    text: str = Form(...), 
    existing_tags: str = Form(""), # 接收前端通过 FormData 传来的标签
    image: UploadFile = File(...)
):
    print(f"📷 收到图片，正在上传并解析 (Model: {GEMINI_MODEL})...")
    
    image_content = await image.read()
    base64_image = base64.b64encode(image_content).decode('utf-8')
    media_type = image.content_type or "image/jpeg"

    client = get_client()
    dynamic_prompt = build_dynamic_prompt(existing_tags)

    try:
        completion = client.chat.completions.create(
            model=GEMINI_MODEL, 
            messages=[
                {"role": "system", "content": dynamic_prompt},
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
            temperature=0.1 # 极低温度
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
    print(f"🚀 服务启动中...")
    uvicorn.run(app, host="0.0.0.0", port=8000)