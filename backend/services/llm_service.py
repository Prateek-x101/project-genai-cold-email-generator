import os
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.core.config import settings

def get_llm(provider: str, api_key: str, temperature: float = 0.0, model_name: str | None = None):
    """
    Factory to return a LangChain Chat Model instance for a given provider.
    Falls back to environment variables if request API key is not supplied.
    """
    key = api_key.strip() if api_key else ""
    
    if provider == "groq":
        active_key = key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
        if not active_key:
            raise ValueError("Groq API key is missing. Please add it in settings.")
        active_model = model_name.strip() if model_name else "llama-3.3-70b-versatile"
        return ChatGroq(
            temperature=temperature,
            groq_api_key=active_key,
            model_name=active_model
        )
        
    elif provider == "openai":
        active_key = key or settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
        if not active_key:
            raise ValueError("OpenAI API key is missing. Please add it in settings.")
        active_model = model_name.strip() if model_name else "gpt-4o-mini"
        return ChatOpenAI(
            temperature=temperature,
            openai_api_key=active_key,
            model_name=active_model
        )
        
    elif provider == "gemini":
        active_key = key or settings.GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY")
        if not active_key:
            raise ValueError("Gemini API key is missing. Please add it in settings.")
        active_model = model_name.strip() if model_name else "gemini-1.5-flash"
        return ChatGoogleGenerativeAI(
            temperature=temperature,
            google_api_key=active_key,
            model=active_model
        )
        
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")
