"""
Mock WebLLM implementation for testing The Storyteller without GPU requirements.
This simulates the WebLLM API to test integration points.
"""
import asyncio
import json
import math
import random
from typing import Dict, List, Any, AsyncIterator


class MockMLCEngine:
    """Mock implementation of WebLLM's MLCEngine."""
    
    def __init__(self):
        self.loaded = False
        self.model_id = None
        self.completions = MockCompletions(self)
        
    async def reload(self, model_id: str, chat_config: Any = None, app_config: Dict = None):
        """Simulate model loading with progress callbacks."""
        self.model_id = model_id
        progress_callback = app_config.get('initProgressCallback') if app_config else None
        
        # Simulate loading progress
        for i in range(0, 101, 10):
            if progress_callback:
                progress_callback({
                    'progress': i / 100,
                    'text': f'Loading model... {i}%' if i < 100 else 'Model loaded!',
                    'timeElapsed': i * 0.1
                })
            await asyncio.sleep(0.01)  # Simulate loading time
            
        self.loaded = True


class MockCompletions:
    """Mock implementation of completions API."""
    
    def __init__(self, engine):
        self.engine = engine
        
    async def create(self, messages: List[Dict] = None, prompt: str = None, 
                    temperature: float = 0.7, top_p: float = 0.9,
                    max_tokens: int = 1000, stream: bool = True,
                    logprobs: bool = True, top_logprobs: int = 5, **kwargs):
        """Create mock completions with realistic token probabilities."""
        
        if stream:
            return self._create_stream(prompt or messages[-1]['content'], 
                                     temperature, top_p, max_tokens, 
                                     logprobs, top_logprobs)
        else:
            # Non-streaming response
            tokens = []
            async for chunk in self._create_stream(prompt or messages[-1]['content'],
                                                  temperature, top_p, max_tokens,
                                                  logprobs, top_logprobs):
                if chunk.choices[0].delta.content:
                    tokens.append(chunk)
            return MockCompletionResponse(tokens)
    
    async def _create_stream(self, prompt: str, temperature: float, top_p: float,
                           max_tokens: int, logprobs: bool, top_logprobs: int):
        """Generate mock streaming response with realistic tokens and probabilities."""
        
        # Sample story tokens based on prompt
        story_tokens = self._get_story_tokens(prompt)
        
        for i, token in enumerate(story_tokens[:max_tokens]):
            # Generate realistic logprobs for this token
            token_logprobs = self._generate_token_logprobs(token, temperature, top_logprobs)
            
            chunk = MockChunk(
                content=token,
                logprobs=token_logprobs if logprobs else None,
                index=i
            )
            
            yield chunk
            await asyncio.sleep(0.005)  # Simulate generation delay
    
    def _get_story_tokens(self, prompt: str) -> List[str]:
        """Generate a mock story based on the prompt."""
        if "robot" in prompt.lower() and "paint" in prompt.lower():
            return [
                "In", " the", " ruins", " of", " what", " was", " once", " Central", " Park",
                ",", " a", " lone", " robot", " named", " Circuit", " discovered", " something",
                " extraordinary", ":", " a", " forgotten", " art", " supply", " store", ".",
                " Among", " the", " debris", ",", " tubes", " of", " paint", " still", " gleamed",
                " with", " vibrant", " colors", ",", " untouched", " by", " decades", " of",
                " decay", ".", " Circuit", "'s", " sensors", " whirred", " as", " it", " analyzed",
                " the", " pigments", ",", " cross", "-referencing", " with", " its", " database",
                " of", " pre", "-war", " human", " culture", ".", " 'Art,'", " it", " whispered",
                ",", " its", " voice", " box", " crackling", " with", " static", "."
            ]
        else:
            # Generic story tokens
            return [
                "Once", " upon", " a", " time", ",", " in", " a", " land", " far", " away",
                ",", " there", " lived", " a", " mysterious", " figure", " who", " possessed",
                " an", " ancient", " secret", ".", " This", " secret", " had", " been",
                " passed", " down", " through", " generations", ",", " whispered", " only",
                " in", " the", " darkest", " hours", " of", " the", " night", "."
            ]
    
    def _generate_token_logprobs(self, token: str, temperature: float, top_k: int) -> Dict:
        """Generate realistic logprob data for a token."""
        # Create probability distribution
        candidates = self._get_alternative_tokens(token)[:top_k]
        
        # Generate probabilities with temperature scaling
        raw_probs = [random.random() for _ in candidates]
        
        # Apply temperature and softmax
        scaled_probs = [p / temperature for p in raw_probs]
        exp_probs = [math.exp(p) for p in scaled_probs]
        sum_exp = sum(exp_probs)
        probs = [p / sum_exp for p in exp_probs]
        
        # Convert to logprobs
        logprobs_data = []
        for i, (candidate, prob) in enumerate(zip(candidates, probs)):
            logprobs_data.append({
                'token': candidate,
                'logprob': math.log(prob),
                'prob': prob,
                'bytes': candidate.encode('utf-8').hex()
            })
        
        # Sort by probability (descending)
        logprobs_data.sort(key=lambda x: x['logprob'], reverse=True)
        
        # Ensure the actual token is first (highest probability)
        actual_token_data = {
            'token': token,
            'logprob': logprobs_data[0]['logprob'] if logprobs_data else -0.5,
            'prob': logprobs_data[0]['prob'] if logprobs_data else 0.6,
            'bytes': token.encode('utf-8').hex()
        }
        
        return {
            'content': [actual_token_data] + logprobs_data[:top_k-1]
        }
    
    def _get_alternative_tokens(self, token: str) -> List[str]:
        """Get plausible alternative tokens for hover display."""
        alternatives = {
            "In": ["Within", "Inside", "At", "Throughout", "Amid"],
            " the": [" a", " this", " that", " their", " our"],
            " robot": [" machine", " android", " automaton", " cyborg", " bot"],
            " paint": [" color", " draw", " create", " sketch", " design"],
            " discovered": [" found", " uncovered", " revealed", " noticed", " spotted"],
            ",": [".", ";", ":", "—", "..."],
            " and": [" but", " or", " yet", " while", " as"],
            # Default alternatives for any token
        }
        
        return alternatives.get(token, [
            token + "ed", token + "ing", token + "s", 
            "the", "and", "of", "to", "a"
        ])


class MockChunk:
    """Mock streaming chunk response."""
    
    def __init__(self, content: str, logprobs: Dict = None, index: int = 0):
        self.choices = [MockChoice(content, logprobs)]
        self.index = index


class MockChoice:
    """Mock choice within a chunk."""
    
    def __init__(self, content: str, logprobs: Dict = None):
        self.delta = MockDelta(content, logprobs)
        self.index = 0


class MockDelta:
    """Mock delta containing content and logprobs."""
    
    def __init__(self, content: str, logprobs: Dict = None):
        self.content = content
        self.logprobs = logprobs


class MockCompletionResponse:
    """Mock non-streaming completion response."""
    
    def __init__(self, chunks: List[MockChunk]):
        content = ''.join(c.choices[0].delta.content for c in chunks if c.choices[0].delta.content)
        self.choices = [MockResponseChoice(content)]


class MockResponseChoice:
    """Mock response choice."""
    
    def __init__(self, content: str):
        self.message = {'content': content}


# Mock WebLLM module interface
class MockWebLLM:
    """Mock WebLLM module."""
    
    def __init__(self):
        self.MLCEngine = MockMLCEngine
        self.CreateMLCEngine = self._create_engine
        self.prebuiltAppConfig = {
            'model_list': [
                {'model_id': 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC'},
                {'model_id': 'Llama-3.1-8B-Instruct-q4f32_1-MLC'},
                {'model_id': 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC'}
            ]
        }
    
    async def _create_engine(self, model_id: str, config: Dict = None):
        """Factory function to create engine."""
        engine = MockMLCEngine()
        await engine.reload(model_id, app_config=config)
        return engine
