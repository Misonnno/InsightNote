# backend/test_api.py
import os
import httpx
from openai import OpenAI
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
base_url = os.getenv("GEMINI_BASE_URL")
model = os.getenv("GEMINI_MODEL")

print(f"--- 配置检查 ---")
print(f"API Key:  {api_key[:8]}******" if api_key else "❌ 未找到 API Key")
print(f"Base URL: {base_url}")
print(f"Model:    {model}")
print(f"----------------")

# 强制直连，不走代理
http_client = httpx.Client(trust_env=False)

client = OpenAI(
    api_key=api_key,
    base_url=base_url,
    http_client=http_client,
    timeout=30.0 # 测试时设置短一点，30秒不通就报错
)

print("\n🚀 正在发起请求 (最多等待 30 秒)...")

try:
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "你好，请回复“连接成功”四个字。"}],
        stream=True # 测试用非流式，简单直接
    )
    print("\n✅ 测试成功！API 返回结果：")
    print(response.choices[0].message.content)

except Exception as e:
    print("\n❌ 测试失败！详细报错如下：")
    print(e)