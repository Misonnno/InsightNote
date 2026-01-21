from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import base64

app = FastAPI()

# 允许跨域 (让前端能连上)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Question(BaseModel):
    text: str

# ================= 🔑 密钥配置区 (填这里！) =================

# 1. DeepSeek 官方配置 (你花了10块钱那个)
# 用来处理纯文字对话
DEEPSEEK_API_KEY = "sk-f3d7c2773ef345b0a59694320058542c" 
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

# 2. 硅基流动配置 (用来调用 Qwen 看图)
# 去 https://cloud.siliconflow.cn/account/ak 获取
SILICON_API_KEY = "sk-vxxgqmofwqfrpgbqccuapwxbbqxhtldsgjrrbuotaozsndjj" 
SILICON_BASE_URL = "https://api.siliconflow.cn/v1"

# 这里的模型名字我是根据你截图里最强的那个写的
SILICON_VISION_MODEL = "Qwen/Qwen2.5-VL-72B-Instruct"

# ==========================================================

@app.post("/ask_ai")
def ask_ai(question: Question):
    """纯文字模式：调用 DeepSeek V3"""
    try:
        client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个专业的软件工程导师，善于分析错题和代码。"},
                {"role": "user", "content": question.text}
            ],
            stream=False
        )
        return {"answer": response.choices[0].message.content}
    except Exception as e:
        print(f"DeepSeek 报错: {e}")
        return {"error": f"文字分析失败: {str(e)}"}

@app.post("/analyze_image")
async def analyze_image(text: str = Form(...), image: UploadFile = File(...)):
    """图片模式：调用 Qwen 2.5-VL (通过硅基流动)"""
    try:
        # 1. 把上传的图片转成 Base64 格式
        image_content = await image.read()
        base64_image = base64.b64encode(image_content).decode('utf-8')
        
        # 2. 连接硅基流动
        client = OpenAI(api_key=SILICON_API_KEY, base_url=SILICON_BASE_URL)

        # 3. 发送请求 (Qwen 2.5 VL)
        response = client.chat.completions.create(
            model=SILICON_VISION_MODEL, 
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text}, # 用户的问题
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}" # 图片数据
                            },
                        },
                    ],
                }
            ],
            stream=False
        )
        return {"answer": response.choices[0].message.content}

    except Exception as e:
        print(f"Qwen 报错: {e}")
        return {"error": f"图片识别失败: {str(e)}"}