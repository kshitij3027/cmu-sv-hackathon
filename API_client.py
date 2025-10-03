"""
Flexible API Client for OpenRouter and OpenAI

Usage:
    Set environment variables:
    - OPENROUTER_API_KEY=your_key (for OpenRouter)
    - OPENAI_API_KEY=your_key (for OpenAI)

    Then call with provider parameter:
    response = await make_API_call(model_name, messages, "openrouter")
    response = await make_API_call(model_name, messages, "openai")

    Or use the alias:
    response = await make_openrouter_call(model_name, messages, "openrouter")
"""

import openai
import os
import asyncio
from typing import Optional, List, Dict, Any

# API Provider configuration - API keys from environment
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Client cache to avoid reinitializing
client_cache = {}

def get_client_for_provider(provider: str):
    """Get or create a client for the specified provider."""
    provider = provider.lower()

    if provider in client_cache:
        return client_cache[provider]

    if provider == "openrouter":
        if not OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY environment variable is required for OpenRouter API")
        client = openai.AsyncOpenAI(
            api_key=OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1"
        )
        print("🔧 Initialized OpenRouter client")

    elif provider == "openai":
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is required for OpenAI API")
        client = openai.AsyncOpenAI(
            api_key=OPENAI_API_KEY,
        )
        print("🔧 Initialized OpenAI client")

    else:
        raise ValueError(f"Unsupported API provider: {provider}. Use 'openrouter' or 'openai'")

    client_cache[provider] = client
    return client

async def make_API_call(model_name: str, messages: List[Dict[str, Any]], provider: str = "openrouter", **kwargs) -> Optional[Any]:
    """
    Make an API call using the specified provider (OpenRouter or OpenAI).

    Args:
        model_name: The model to use for the API call
        messages: List of message dictionaries for the conversation
        provider: The API provider to use ("openrouter" or "openai")
        **kwargs: Additional parameters to pass to the API call

    Returns:
        API response object or None if failed
    """
    try:
        # Get the appropriate client for the provider
        client = get_client_for_provider(provider)

        # Add parallel-safe logging with request ID for tracking
        request_id = f"{model_name}_{id(messages)}"
        print(f"🤖 [{request_id}] Making {provider.upper()} API call")

        # Prepare common parameters
        call_params = {
            "model": model_name,
            "messages": messages,
        }

        # Add any additional parameters
        call_params.update(kwargs)

        response = await client.chat.completions.create(**call_params)
        print(f"✅ [{request_id}] {provider.upper()} API call completed")
        return response

    except Exception as e:
        request_id = f"{model_name}_{id(messages)}"
        print(f"❌ [{request_id}] Error making {provider.upper()} API call: {e}")
        return None

# Alias for backward compatibility
make_openrouter_call = make_API_call

def get_available_providers() -> List[str]:
    """Get list of available API providers."""
    return ["openrouter", "openai"]

def get_cached_providers() -> List[str]:
    """Get list of providers that have been cached/initialized."""
    return list(client_cache.keys())

