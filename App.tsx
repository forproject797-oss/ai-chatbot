import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, Sender } from './types';
import { Sender as SenderEnum } from './types';
import { createChatSession, sendMessageToAI } from './services/geminiService';
import type { Chat } from '@google/genai';

// Fix: Add type definitions for the browser's Speech Recognition API
// to resolve TypeScript errors about missing properties on the 'window' object and when using SpeechRecognition as a type.
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}

// --- Helper Components (Defined outside the main App to prevent re-creation on re-renders) ---

const BotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
        <path d="M8.25 12a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Z" />
    </svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-800" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
);

const SpeakerOnIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);

const SpeakerOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);


interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isBot = message.sender === SenderEnum.Bot;
  return (
    <div className={`flex items-start gap-3 my-4 ${isBot ? '' : 'flex-row-reverse'}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isBot ? 'bg-blue-600' : 'bg-white'}`}>
        {isBot ? <BotIcon /> : <UserIcon />}
      </div>
      <div className={`p-4 rounded-2xl max-w-lg animate-fade-in ${isBot ? 'bg-white text-black rounded-bl-none' : 'bg-blue-100 text-black rounded-br-none'}`}>
        <p className="text-sm leading-relaxed">{message.text}</p>
      </div>
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="flex items-start gap-3 my-4">
    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-blue-600">
      <BotIcon />
    </div>
    <div className="p-4 rounded-2xl bg-white text-gray-800 rounded-bl-none">
      <div className="flex items-center space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
      </div>
    </div>
  </div>
);

interface ChatInputProps {
  onSendMessage: (input: string) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const handleMicClick = () => {
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => setInput(event.results[0][0].transcript);
    recognition.onerror = (event) => console.error("Speech recognition error:", event.error);
    recognition.onend = () => setIsRecording(false);
    
    recognition.start();
  };


  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-200">
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your symptoms or use the mic..."
          disabled={isLoading}
          className="w-full pl-4 pr-24 py-3 bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-slate-900"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {SpeechRecognition && (
            <button
              type="button"
              onClick={handleMicClick}
              disabled={isLoading}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                <path d="M5.5 10.5a.5.5 0 01.5-.5h8a.5.5 0 010 1h-8a.5.5 0 01-.5-.5z" />
                <path d="M10 18a5 5 0 005-5h-1.5a3.5 3.5 0 11-7 0H5a5 5 0 005 5z" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 bg-blue-600 rounded-full text-white flex items-center justify-center hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </form>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [chat, setChat] = useState<Chat | null>(null);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState<boolean>(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const speakText = useCallback((text: string) => {
    if (!isSpeechEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, [isSpeechEnabled]);

  useEffect(() => {
    const initChat = async () => {
      const chatSession = createChatSession();
      setChat(chatSession);
      const initialMessageText = 'Hello! I can help you check your symptoms and find a doctor. To start, could you please tell me your name and age?';
      const initialMessage: Message = {
        id: 'init',
        text: initialMessageText,
        sender: SenderEnum.Bot,
      };
      setMessages([initialMessage]);
      setIsLoading(false);
      // A small delay to ensure synthesis is ready
      setTimeout(() => speakText(initialMessageText), 100);
    };
    initChat();
  }, [speakText]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  
  useEffect(() => {
    return () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    };
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!chat) return;

    window.speechSynthesis.cancel();

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: SenderEnum.User,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const botResponseText = await sendMessageToAI(chat, text);

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: botResponseText,
      sender: SenderEnum.Bot,
    };
    setMessages((prev) => [...prev, botMessage]);
    setIsLoading(false);
    speakText(botResponseText);
  }, [chat, speakText]);
  
  const toggleSpeech = () => {
    setIsSpeechEnabled(prev => {
        const newState = !prev;
        if (!newState) {
            window.speechSynthesis.cancel();
        }
        return newState;
    });
  };

  return (
    <div className="h-screen w-screen bg-slate-100 flex flex-col font-sans antialiased">
      <header className="bg-white shadow-md p-4 z-10 border-b border-slate-200">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    AI
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">AI Medical Assistant</h1>
                    <p className="text-xs text-slate-500">Your health guidance partner</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                 <button onClick={toggleSpeech} className="text-slate-500 hover:text-blue-600 transition-colors" aria-label={isSpeechEnabled ? 'Disable voice output' : 'Enable voice output'}>
                    {isSpeechEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
                </button>
                <div className="text-right">
                    <p className="text-xs font-semibold text-red-500">Not for emergencies</p>
                    <p className="text-xs text-slate-500">This is not a medical diagnosis.</p>
                </div>
            </div>
        </div>
      </header>
      
      <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && <TypingIndicator />}
        </div>
      </main>
      
      <footer className="w-full">
         <div className="max-w-4xl mx-auto">
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
         </div>
      </footer>
       <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }
      `}</style>
    </div>
  );
};

export default App;
