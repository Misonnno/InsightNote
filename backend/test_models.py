import os
from google import genai

# --- 记得把这里改成你的代理端口 ---
os.environ["HTTP_PROXY"] = "http://127.0.0.1:7890"
os.environ["HTTPS_PROXY"] = "http://127.0.0.1:7890"

# --- 记得把这里改成你的 API Key ---
client = genai.Client(api_key="你的_AIza_开头的Key")

try:
    print("正在连接 Google 服务器查询可用模型...")
    # 获取模型列表
    models = client.models.list(config={"page_size": 100}) 
    
    print("\n✅ 你的账号可以使用以下模型：")
    for m in models:
        # 只打印支持生成的模型
        if "generateContent" in m.supported_generation_methods:
            print(f"- {m.name}")
            
except Exception as e:
    print(f"\n❌ 出错了：{e}")