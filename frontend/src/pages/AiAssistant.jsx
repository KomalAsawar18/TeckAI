import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Send, Sparkles, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import Loader from '../components/common/Loader';
import './AiAssistant.css';

const AiAssistant = () => {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Hello! I am your TeckAI Shopping Assistant. I can help you find hardware in our catalog matching your specific workloads, compare specifications, or answer technical questions. Try asking: 'I need a programming laptop under 200k'!",
      products: []
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const chatEndRef = useRef(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim() || loading) return;

    // Add user message to local feed
    const userMessage = { sender: 'user', text: query.trim(), products: [] };
    setMessages(prev => [...prev, userMessage]);
    
    setInputText('');
    setLoading(true);
    setError(null);

    // Format chat history for backend (converting sender user/ai to role user/model)
    const chatHistory = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      content: msg.text
    }));

    try {
      const res = await api.sendAiChat(query.trim(), chatHistory);
      
      if (res.success) {
        const aiMessage = {
          sender: 'ai',
          text: res.data.response,
          products: res.data.products || []
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(res.error?.message || 'Failed to get recommendation response');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please check your connection.');
      // Add error message to chat log for user clarity
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: '❌ Error: I ran into an issue communicating with the AI server. Please try again in a few moments.',
        products: []
      }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestionChips = [
    "Laptops under 250k for coding & Docker",
    "Compare Sony WH-1000XM5 vs Bose Ultra",
    "Silent keyboard for office typing",
    "Fastest gaming keyboard in stock"
  ];

  return (
    <div className="ai-assistant-page container py-8 fade-in">
      <div className="assistant-header text-center mb-8">
        <div className="ai-glow-badge inline-flex align-center gap-2 mb-3">
          <Sparkles size={14} />
          <span>Grounded AI Expert</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">TeckAI Shopping Assistant</h1>
        <p className="text-secondary text-sm max-w-xl mx-auto">
          Natural language guidance grounded directly in our database. Ask about programming, Docker compilation, travel noise cancelation, or silent tactile keyboards.
        </p>
      </div>

      <div className="chat-interfacecard card flex flex-col">
        {/* Chat Feed */}
        <div className="chat-messages-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-row flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="message-wrapper flex flex-col max-w-3xl">
                {/* Message Bubble */}
                <div className={`message-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                  {msg.sender === 'ai' && <Sparkles size={14} className="bubble-ai-sparkle" />}
                  <div className="message-text">{msg.text}</div>
                </div>

                {/* Grounded Recommended Products Cards */}
                {msg.products && msg.products.length > 0 && (
                  <div className="message-grounded-products mt-3">
                    <span className="grounded-title text-xs text-muted flex align-center gap-1 mb-2 font-semibold">
                      <ShoppingBag size={12} />
                      <span>Matching products in stock:</span>
                    </span>
                    <div className="grounded-products-grid">
                      {msg.products.map((product, pIdx) => (
                        <Link key={pIdx} to={`/products/${product.slug}`} className="grounded-product-card card p-3 flex align-center gap-3">
                          {product.images && product.images.length > 0 && (
                            <img src={product.images[0]} alt={product.name} className="grounded-prod-img" />
                          )}
                          <div className="grounded-prod-info">
                            <h4 className="grounded-prod-name text-xs font-bold text-primary">{product.name}</h4>
                            <div className="flex justify-between align-center mt-1">
                              <span className="grounded-prod-price text-xs font-semibold">PKR {product.price?.toLocaleString()}</span>
                              <span className="text-xxs text-accent flex align-center gap-1 font-semibold">
                                <span>Details</span>
                                <ArrowRight size={10} />
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row flex justify-start">
              <div className="message-bubble bubble-ai loading-bubble">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="chat-error-toast flex align-center gap-2 p-3 mt-3">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length === 1 && (
          <div className="chat-suggestions-panel p-4 flex flex-wrap gap-2 justify-center border-top">
            {suggestionChips.map((chip, cIdx) => (
              <button key={cIdx} className="btn btn-secondary chip-btn" onClick={() => handleSend(chip)}>
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Console */}
        <div className="chat-input-console p-4 border-top flex align-center gap-3">
          <div className="input-wrapper flex-grow flex flex-col">
            <textarea
              className="chat-textarea"
              placeholder="Ask TeckAI..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value.substring(0, 500))}
              onKeyDown={onKeyDown}
              rows={1}
            />
            <span className="text-xxs text-muted align-self-end mt-1">
              {inputText.length}/500 characters
            </span>
          </div>
          <button className="btn btn-primary send-btn" onClick={() => handleSend()} disabled={!inputText.trim() || loading}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiAssistant;
