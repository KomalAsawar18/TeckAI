import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { Send, Sparkles, AlertCircle, ShoppingBag, ArrowRight, Table, Info, RefreshCw, MessageSquare, ArrowDownRight, Clock, Plus, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import './AiAssistant.css';

class AiErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AiAssistant Error Boundary Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-6 flex flex-col align-center text-center justify-center my-8">
          <AlertCircle className="text-danger mb-4" size={32} />
          <h3 className="text-lg font-bold mb-2">Something went wrong loading this conversation.</h3>
          <p className="text-muted text-sm mb-6">A runtime error occurred displaying the chat.</p>
          <div className="flex gap-3 justify-center">
            <button 
              className="btn btn-secondary"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onRetry && this.props.onRetry();
              }}
            >
              Retry
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onNewChat && this.props.onNewChat();
              }}
            >
              Start New Chat
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AiAssistant = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialConversationId = new URLSearchParams(location.search).get('c') || null;

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
  
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId);
  const [showHistory, setShowHistory] = useState(false);
  const [isRestoringConversation, setIsRestoringConversation] = useState(!!initialConversationId);

  const containerRef = useRef(null);
  const chatEndRef = useRef(null);
  const hasInitializedRef = useRef(false);

  // Normalization layer to guarantee shape
  const normalizeProduct = (product) => {
    if (!product || typeof product !== 'object') return null;
    
    // Parse price safely to number
    let parsedPrice = null;
    if (typeof product.price === 'number') {
      parsedPrice = product.price;
    } else if (typeof product.price === 'string') {
      const num = parseFloat(product.price.replace(/[^\d.-]/g, ''));
      if (!isNaN(num)) parsedPrice = num;
    }

    return {
      canonicalProductId: product.canonicalProductId || product.id || product._id || null,
      name: typeof product.name === 'string' ? product.name : 'Unknown Product',
      brand: typeof product.brand === 'string' ? product.brand : '',
      model: typeof product.model === 'string' ? product.model : '',
      price: parsedPrice,
      currency: typeof product.currency === 'string' ? product.currency : 'PKR',
      seller: typeof product.seller === 'string' ? product.seller : '',
      availability: typeof product.availability === 'string' ? product.availability.toLowerCase() : 'unknown',
      offerCount: typeof product.offerCount === 'number' ? product.offerCount : 1,
      image: typeof product.image === 'string' ? product.image : (Array.isArray(product.images) && typeof product.images[0] === 'string' ? product.images[0] : null),
      specifications: product.specifications && typeof product.specifications === 'object' ? product.specifications : {}
    };
  };

  const normalizeMessage = (msg) => {
    if (!msg || typeof msg !== 'object') return null;
    const normalizedProducts = Array.isArray(msg.products) 
      ? msg.products.map(normalizeProduct).filter(Boolean) 
      : [];
      
    return {
      sender: msg.role === 'user' || msg.sender === 'user' ? 'user' : 'ai',
      text: typeof msg.content === 'string' ? msg.content : (typeof msg.text === 'string' ? msg.text : ''),
      type: normalizedProducts.length > 0 ? 'catalog_grounded' : 'general_guidance',
      products: normalizedProducts,
      sections: Array.isArray(msg.sections) ? msg.sections : [],
      comparisonTable: msg.comparisonTable || null,
      isError: msg.isError || false
    };
  };

  // Fetch recent conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await api.getAiConversations();
        if (res.success && Array.isArray(res.data)) {
          setConversations(res.data);
        }
      } catch (err) {
        // Ignore if guest
      }
    };
    fetchConversations();
  }, []);

  const isNavigatingToHistory = useRef(initialConversationId ? true : false);
  const activeRequestRef = useRef(null);

  // Load specific conversation if ID present
  useEffect(() => {
    const loadConversation = async () => {
      if (!activeConversationId) return;
      if (!isNavigatingToHistory.current && hasInitializedRef.current) return;
      
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }
      const abortController = new AbortController();
      activeRequestRef.current = abortController;

      try {
        setIsRestoringConversation(true);
        const res = await api.getAiConversationById(activeConversationId, { signal: abortController.signal });
        
        // Ensure this response is still for the current active ID
        if (abortController.signal.aborted) return;
        
        if (res.success && Array.isArray(res.data?.messages) && res.data.messages.length > 0) {
          const loadedMessages = res.data.messages.map(normalizeMessage).filter(Boolean);
          setMessages(loadedMessages);
          isNavigatingToHistory.current = false;
        } else {
          // Empty or invalid messages format
          throw new Error('Invalid conversation format');
        }
      } catch (err) {
        if (err.name === 'AbortError') return; // Ignore aborts
        
        // Show fallback for 404 / malformed
        setMessages([normalizeMessage({
          sender: 'ai',
          content: '❌ Conversation unavailable or no longer exists. Please start a new chat.',
          isError: true
        })]);
      } finally {
        if (!abortController.signal.aborted) {
          setIsRestoringConversation(false);
        }
      }
    };
    
    if (activeConversationId) {
      loadConversation();
    } else {
      setIsRestoringConversation(false);
    }
  }, [activeConversationId, navigate]);

  // Handle auto-queries from the homepage
  useEffect(() => {
    if (location.state?.initialMessage && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      handleSend(location.state.initialMessage);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const scrollToBottom = (force = false) => {
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 250;
    if (isNearBottom || force) {
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      isNavigatingToHistory.current = true;
      const urlParams = new URLSearchParams(window.location.search);
      const cId = urlParams.get('c');
      setActiveConversationId(cId || null);
      if (!cId) {
        setMessages([{
          sender: 'ai',
          text: "Tell me what you need and I'll help you find the best match from our catalog.",
          type: 'general_guidance',
          products: []
        }]);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([{
      sender: 'ai',
      text: "Tell me what you need and I'll help you find the best match from our catalog.",
      type: 'general_guidance',
      products: []
    }]);
    navigate('/ai-assistant');
    setShowHistory(false);
  };

  const loadPastChat = (id) => {
    isNavigatingToHistory.current = true;
    setActiveConversationId(id);
    navigate(`/ai-assistant?c=${id}`);
    setShowHistory(false);
    hasInitializedRef.current = false; // allow reload hook to trigger
  };
  const handleSend = async (textToSend, options = {}) => {
    const query = textToSend || inputText;
    if (!query.trim() || loading) return;

    // Check if this exact text is already the last user message (retry scenario)
    const isRetry = messages.length > 0 && 
                    messages[messages.length - 1].sender === 'user' && 
                    messages[messages.length - 1].text === query.trim();

    if (!isRetry) {
      // Add user message to feed
      const userMessage = { sender: 'user', text: query.trim() };
      setMessages(prev => [...prev, userMessage]);
    }
    
    setInputText('');
    setLoading(true);
    setError(null);

    // Remove any previous error message from AI before retrying
    setMessages(prev => prev.filter(msg => !(msg.sender === 'ai' && msg.isError)));

    try {
      const res = await api.sendAiChat(query.trim(), {
        conversationId: activeConversationId,
        canonicalProductId: options.canonicalProductId,
        actionIntent: options.actionIntent
      });
      
      if (res.success) {
        if (res.data.conversationId && !activeConversationId) {
          setActiveConversationId(res.data.conversationId);
          window.history.replaceState(null, '', `?c=${res.data.conversationId}`);
        }
        
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
      const returnedCid = err.payload?.conversationId;
      if (returnedCid && !activeConversationId) {
        setActiveConversationId(returnedCid);
        window.history.replaceState(null, '', `?c=${returnedCid}`);
      }
      
      setError(err.message || 'Something went wrong. Please check your connection.');
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: '❌ Error: I ran into an issue communicating with the AI server. Please try again in a few moments.',
        type: 'general_guidance',
        products: [],
        isError: true
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
      if (!loading) {
        handleSend();
      }
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
    <AiErrorBoundary onNewChat={handleNewChat} onRetry={() => window.location.reload()}>
    <div className="ai-assistant-page container py-8 fade-in">
      <div className="assistant-header text-center mb-6">
        <div className="ai-glow-badge inline-flex align-center gap-2 mb-3">
          <Sparkles size={13} />
          <span>Intelligent Shopping Assistant</span>
        </div>
        <h1 className="text-3xl font-bold mb-4">Ask TeckAI</h1>
        <p className="text-secondary text-base max-w-2xl mx-auto leading-relaxed">
          Hardware recommendations grounded directly in our database. Ask questions, compare products, or analyze specs.
        </p>
      </div>

      <div className="chat-interfacecard card flex flex-col relative">
        {/* History Controls / Header */}
        <div className="chat-interface-header flex justify-between align-center p-3 border-bottom mb-2 bg-surface rounded-t-lg">
          <button className="btn btn-secondary btn-sm flex align-center gap-1.5" onClick={handleNewChat}>
            <Plus size={14} />
            <span>New Chat</span>
          </button>
          
          <div className="relative">
            <button 
              className={`btn btn-sm flex align-center gap-1.5 ${showHistory ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setShowHistory(!showHistory)}
            >
              <Clock size={14} />
              <span>History</span>
            </button>
            
            {showHistory && (
              <div className="history-dropdown absolute right-0 mt-2 w-64 bg-surface border rounded-md shadow-lg z-10">
                <div className="p-2 border-bottom">
                  <span className="text-xs font-semibold text-secondary">Recent Conversations</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {conversations.length === 0 ? (
                    <div className="p-3 text-xs text-muted text-center">No recent conversations</div>
                  ) : (
                    conversations.map(conv => (
                      <button 
                        key={conv._id} 
                        className={`w-full text-left p-2 text-xs flex align-center gap-2 hover-bg-accent transition-colors ${activeConversationId === conv._id ? 'bg-accent font-semibold' : ''}`}
                        onClick={() => loadPastChat(conv._id)}
                      >
                        <MessageSquare size={12} className="text-muted flex-shrink-0" />
                        <span className="truncate">{conv.title || 'Untitled Chat'}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Messages Log */}
        <div ref={containerRef} className="chat-messages-container relative">
          {isRestoringConversation ? (
            <div className="flex flex-col align-center justify-center p-8 text-muted fade-in" style={{height: '200px'}}>
              <Loader2 className="spinning mb-2" size={24} />
              <div className="text-sm">Restoring conversation...</div>
            </div>
          ) : (
            Array.isArray(messages) && messages.map((msg, idx) => (
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
                <div className={`message-bubble flex gap-3 ${msg.sender === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                  {msg.sender === 'ai' && (
                    <div className="flex-shrink-0 mt-1 text-accent-highlight">
                      <Sparkles size={16} />
                    </div>
                  )}
                  <div className="message-text pt-0.5">{renderMessageText(msg.text)}</div>

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
                        const validId = product.canonicalProductId || product.id || product._id;
                        const specsSummary = formatSpecs(product);
                        
                        let availText = 'Availability unknown';
                        let availClass = 'text-muted';
                        
                        if (product.availability === 'in_stock') {
                          availText = 'In Stock';
                          availClass = 'text-success';
                        } else if (product.availability === 'out_of_stock') {
                          availText = 'Out of Stock';
                          availClass = 'text-danger';
                        } else if (product.availability === 'pre_order') {
                          availText = 'Pre-order';
                          availClass = 'text-warning';
                        } else if (product.stock !== undefined && product.stock > 0) {
                          availText = 'In Stock';
                          availClass = 'text-success';
                        }
                        
                        const prodImage = product.image || (product.images && product.images.length > 0 ? product.images[0] : null);

                        return (
                          <div key={pIdx} className="grounded-product-card card p-3 flex flex-col justify-between">
                            <div className="flex gap-3">
                              {prodImage && (
                                <img src={prodImage} alt={product.name} className="grounded-prod-img" />
                              )}
                              <div className="grounded-prod-info flex-grow">
                                <h4 className="grounded-prod-name text-xs font-bold text-primary">{product.name}</h4>
                                <div className="text-xxs text-muted mt-0.5">{specsSummary || product.brand}</div>
                                {product.price ? (
                                  <div className="grounded-prod-price text-xs font-bold mt-1 text-primary">PKR {product.price.toLocaleString()}</div>
                                ) : (
                                  <div className="grounded-prod-price text-xs font-bold mt-1 text-muted">Price unavailable</div>
                                )}
                                {product.seller && <div className="text-xxs text-muted mt-0.5">from {product.seller} {product.offerCount > 1 ? `(+${product.offerCount - 1} offers)` : ''}</div>}
                              </div>
                            </div>
                            
                            <div className="grounded-card-bottom flex justify-between align-center mt-3 pt-2 border-top">
                              <span className={`text-xxs font-semibold ${availClass}`}>
                                {availText}
                              </span>
                              {validId && (
                                <RouterLink to={`/canonical-products/${validId}`} className="btn btn-primary btn-xxs">
                                  <span>Details</span>
                                  <ArrowRight size={10} />
                                </RouterLink>
                              )}
                            </div>

                            {/* Contextual Quick Actions */}
                            {validId && (
                              <div className="contextual-actions flex flex-wrap gap-1.5 mt-2.5">
                                <button 
                                  className="action-link-btn text-xxs flex align-center gap-1"
                                  onClick={() => handleSend(`Tell me more about the ${product.name}`, { canonicalProductId: validId, actionIntent: 'ask_details' })}
                                >
                                  <MessageSquare size={10} />
                                  <span>Ask details</span>
                                </button>
                                <button 
                                  className="action-link-btn text-xxs flex align-center gap-1"
                                  onClick={() => handleSend(`Show me cheaper options than ${product.name}`, { canonicalProductId: validId, actionIntent: 'cheaper_alternatives' })}
                                >
                                  <RefreshCw size={10} />
                                  <span>Cheaper alternatives</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )))}

          {loading && !isRestoringConversation && (
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
    </AiErrorBoundary>
  );
};

export default AiAssistant;
