import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Send, Sparkles, AlertCircle, ShoppingBag, ArrowRight, Table, Info, RefreshCw, MessageSquare, ArrowDownRight } from 'lucide-react';
import { api } from '../services/api';
import './AiAssistant.css';

const AiAssistant = () => {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Tell me what you need and I'll help you find the best match from our catalog.",
      sections: [],
      type: 'general_guidance',
      products: []
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const containerRef = useRef(null);
  const chatEndRef = useRef(null);
  const location = useLocation();

  // Handle auto-queries from the homepage
  useEffect(() => {
    if (location.state?.initialMessage) {
      handleSend(location.state.initialMessage);
      // Clear location state history so refreshes don't re-trigger the query
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Smart scroll: scroll to bottom only if user is already near bottom
  const scrollToBottom = (force = false) => {
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 250;
    if (isNearBottom || force) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim() || loading) return;

    // Add user message to feed
    const userMessage = { sender: 'user', text: query.trim() };
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
          sections: res.data.sections || [],
          comparisonTable: res.data.comparisonTable || null,
          type: res.data.type || 'general_guidance',
          products: res.data.products || []
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(res.error?.message || 'Failed to get recommendation response');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please check your connection.');
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: '❌ Error: I ran into an issue communicating with the AI server. Please try again in a few moments.',
        type: 'general_guidance',
        products: []
      }]);
    } finally {
      setLoading(false);
      // Force scroll on response finish
      setTimeout(() => scrollToBottom(true), 100);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Safe inline markdown parser (converts **bold** and sanitizes titles/delimiters)
  const renderMessageText = (text) => {
    if (!text) return null;
    
    let cleanText = text
      .replace(/^###\s*(.*)$/gm, '$1')
      .replace(/^##\s*(.*)$/gm, '$1')
      .replace(/^#\s*(.*)$/gm, '$1')
      .replace(/^---\s*$/gm, '');

    const parts = cleanText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Helper to format specifications lists into compact summaries
  const formatSpecs = (product) => {
    if (!product.specifications) return null;
    const specs = [];
    if (product.specifications.ramGB) specs.push(`${product.specifications.ramGB}GB RAM`);
    if (product.specifications.storageSSD) specs.push(`${product.specifications.storageSSD} SSD`);
    if (product.specifications.hasANC) specs.push('ANC');
    if (product.specifications.wireless) specs.push('Wireless');
    if (product.specifications.mechanical) specs.push('Mechanical');
    return specs.join(' • ');
  };

  const suggestionChips = [
    "Laptop for programming under 200k",
    "Best headphones for office calls",
    "Compare two laptops",
    "DevOps laptop recommendations"
  ];

  return (
    <div className="ai-assistant-page container py-8 fade-in">
      <div className="assistant-header text-center mb-6">
        <div className="ai-glow-badge inline-flex align-center gap-2 mb-3">
          <Sparkles size={13} />
          <span>Intelligent Shopping Assistant</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Ask TeckAI</h1>
        <p className="text-secondary text-sm max-w-xl mx-auto">
          Hardware recommendations grounded directly in our database. Ask questions, compare products, or analyze specs.
        </p>
      </div>

      <div className="chat-interfacecard card flex flex-col">
        {/* Chat Messages Log */}
        <div ref={containerRef} className="chat-messages-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-row flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="message-wrapper flex flex-col max-w-3xl">
                
                {/* Source Verification Badge */}
                {msg.sender === 'ai' && (
                  <div className={`source-indicator flex align-center gap-1 mb-1 text-xxs font-semibold ${msg.type === 'catalog_grounded' ? 'source-catalog' : 'source-general'}`}>
                    {msg.type === 'catalog_grounded' ? (
                      <>
                        <ShoppingBag size={10} />
                        <span>Based on TeckAI catalog</span>
                      </>
                    ) : (
                      <>
                        <Info size={10} />
                        <span>General product guidance</span>
                      </>
                    )}
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`message-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                  {msg.sender === 'ai' && <Sparkles size={14} className="bubble-ai-sparkle" />}
                  <div className="message-text">{renderMessageText(msg.text)}</div>

                  {/* Grounded Sections */}
                  {msg.sections && msg.sections.length > 0 && (
                    <div className="msg-sections-block mt-3 flex flex-col gap-3">
                      {msg.sections.map((sec, sIdx) => (
                        <div key={sIdx} className="msg-section">
                          <h4 className="msg-section-title font-bold text-xs text-primary flex align-center gap-1 mb-1">
                            <span>{sec.title}</span>
                          </h4>
                          <ul className="msg-section-list text-xs flex flex-col gap-1">
                            {sec.items.map((item, iIdx) => (
                              <li key={iIdx} className="flex align-start gap-1.5">
                                <span className="list-dot">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Responsive Comparison Table */}
                  {msg.comparisonTable && msg.comparisonTable.headers && (
                    <div className="msg-comparison-container mt-4 p-1 border rounded-md">
                      <div className="table-header-indicator flex align-center gap-1 text-xxs text-muted p-1 border-bottom">
                        <Table size={10} />
                        <span>Horizontal comparison matrix</span>
                      </div>
                      <div className="table-scroll-wrapper">
                        <table className="msg-comparison-table text-xs">
                          <thead>
                            <tr>
                              {msg.comparisonTable.headers.map((h, hIdx) => (
                                <th key={hIdx}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.comparisonTable.rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className={cIdx === 0 ? "font-semibold" : ""}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Grounded Recommended Product Cards */}
                {msg.products && msg.products.length > 0 && (
                  <div className="message-grounded-products mt-3">
                    <div className="grounded-products-grid">
                      {msg.products.map((product, pIdx) => {
                        const specsSummary = formatSpecs(product);
                        const isStockAvailable = product.stock > 0;
                        return (
                          <div key={pIdx} className="grounded-product-card card p-3 flex flex-col justify-between">
                            <div className="flex gap-3">
                              {product.images && product.images.length > 0 && (
                                <img src={product.images[0]} alt={product.name} className="grounded-prod-img" />
                              )}
                              <div className="grounded-prod-info flex-grow">
                                <h4 className="grounded-prod-name text-xs font-bold text-primary">{product.name}</h4>
                                <div className="text-xxs text-muted mt-0.5">{specsSummary || product.brand}</div>
                                <div className="grounded-prod-price text-xs font-bold mt-1 text-primary">PKR {product.price?.toLocaleString()}</div>
                              </div>
                            </div>
                            
                            <div className="grounded-card-bottom flex justify-between align-center mt-3 pt-2 border-top">
                              <span className={`text-xxs font-semibold ${isStockAvailable ? 'text-success' : 'text-danger'}`}>
                                {isStockAvailable ? `In Stock (${product.stock})` : 'Out of Stock'}
                              </span>
                              <RouterLink to={`/products/${product.slug}`} className="btn btn-primary btn-xxs">
                                <span>Details</span>
                                <ArrowRight size={10} />
                              </RouterLink>
                            </div>

                            {/* Contextual Quick Actions */}
                            <div className="contextual-actions flex flex-wrap gap-1.5 mt-2.5">
                              <button 
                                className="action-link-btn text-xxs flex align-center gap-1"
                                onClick={() => handleSend(`Tell me more about the ${product.name}`)}
                              >
                                <MessageSquare size={10} />
                                <span>Ask details</span>
                              </button>
                              <button 
                                className="action-link-btn text-xxs flex align-center gap-1"
                                onClick={() => handleSend(`Show me cheaper options than ${product.name}`)}
                              >
                                <RefreshCw size={10} />
                                <span>Cheaper alternatives</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row flex justify-start">
              <div className="message-wrapper max-w-md">
                <div className="source-indicator flex align-center gap-1 mb-1 text-xxs font-semibold source-general">
                  <Sparkles size={10} />
                  <span>TeckAI is thinking...</span>
                </div>
                <div className="message-bubble bubble-ai loading-bubble">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="chat-error-toast flex align-center gap-2 p-3 mt-3">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Compact Suggestion Chips */}
        {messages.length === 1 && (
          <div className="chat-suggestions-panel">
            {suggestionChips.map((chip, cIdx) => (
              <button key={cIdx} className="btn btn-secondary chip-btn text-xs" onClick={() => handleSend(chip)}>
                <ArrowDownRight size={12} className="text-accent-highlight" />
                <span>{chip}</span>
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Console (Sticky Composer) */}
        <div className="chat-input-console">
          <div className="input-wrapper">
            <textarea
              className="chat-textarea"
              placeholder="Ask about products, compare specs, set a budget..."
              value={inputText}
              onChange={(e) => {
                const val = e.target.value.substring(0, 500);
                setInputText(val);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
              }}
              onKeyDown={onKeyDown}
              rows={1}
            />
            <span className="char-counter">
              {inputText.length}/500
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
