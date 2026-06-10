'use client';

import { useState, useEffect, useRef } from "react";
import { ref, set, remove, onValue, child } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

// Types for components
interface FloatingHeart {
  id: number;
  left: string;
  size: string;
  driftX: string;
  endX: string;
  angle: string;
  endAngle: string;
  delay: string;
  colorType?: "crimson" | "gold";
}

interface Particle {
  id: number;
  left: string;
  size: string;
  drift: string;
  delay: string;
  duration: string;
}

interface TimeDelta {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface MemoryEntry {
  id: number;
  imageData: string;
  title: string;
  description: string;
  author: "él" | "ella";
  date: string;
  time: string;
}

interface MessageEntry {
  id: number;
  text: string;
  author: "él" | "ella";
  date: string;
  time: string;
}

export default function Home() {
  const [view, setView] = useState<"profile" | "mesarios" | "reconciliations" | "anniversaries" | "photos">(
    () => (typeof window !== "undefined" && (localStorage.getItem("carta_view") as any)) || "reconciliations"
  );
  
  // Audio state
  const [isMuted, setIsMuted] = useState(true);
  const [audioBanner, setAudioBanner] = useState(false);
  
  // Reconciliations specific states
  const [isOpen, setIsOpen] = useState(false);
  const [envelopeFading, setEnvelopeFading] = useState(false);
  const [letterVisible, setLetterVisible] = useState(false);
  const [letterActive, setLetterActive] = useState(false);
  const [paraCount, setParaCount] = useState(0);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  
  // Interactive overlays
  const [feedbackActive, setFeedbackActive] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"hug" | "understand" | "promise" | null>(null);
  
  // Particle systems
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  
  // Shared Journal / Memory Wall state
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAuthor, setFormAuthor] = useState<"él" | "ella">("él");
  const [formImage, setFormImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Toast feedback for errors
  const [toastMsg, setToastMsg] = useState("");

  // PWA install state
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // PWA: register service worker, handle install prompt
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }

    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };

    const handleAppInstalled = () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    (installPrompt as any).prompt();
    const result = await (installPrompt as any).userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  // Listen for real-time memories from Firebase
  useEffect(() => {
    const memoriesRef = ref(db, 'memories');

    // Migrate existing localStorage memories to Firebase
    const stored = localStorage.getItem("carta_memories");
    if (stored) {
      try {
        const localMemories = JSON.parse(stored) as MemoryEntry[];
        if (localMemories.length > 0) {
          localMemories.forEach((mem) => {
            set(child(memoriesRef, String(mem.id)), {
              id: mem.id,
              imageData: mem.imageData,
              title: mem.title,
              description: mem.description,
              author: mem.author,
              date: mem.date,
              time: mem.time,
            }).catch((err) => console.error("Firebase migration error:", err));
          });
        }
        localStorage.removeItem("carta_memories");
      } catch {}
    }

    const unsubscribe = onValue(memoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({
          ...data[key],
        })) as MemoryEntry[];
        list.sort((a, b) => b.id - a.id);
        setMemories(list);
      } else {
        setMemories([]);
      }
    }, (err) => {
      console.error("Firebase memories listener error:", err);
    });

    return unsubscribe;
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedFileRef.current = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addMemory = async () => {
    if (!formImage || !formTitle.trim() || !formDesc.trim()) return;
    const now = new Date();
    const id = Date.now();
    let imageUrl = formImage;

    // Upload image to Firebase Storage if file is available
    if (selectedFileRef.current) {
      try {
        const imgRef = storageRef(storage, `memories/${id}`);
        await uploadBytes(imgRef, selectedFileRef.current);
        imageUrl = await getDownloadURL(imgRef);
      } catch (err) {
        console.error("Firebase upload error:", err);
      }
      selectedFileRef.current = null;
    }

    const entry: MemoryEntry = {
      id,
      imageData: imageUrl,
      title: formTitle.trim(),
      description: formDesc.trim(),
      author: formAuthor,
      date: now.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }),
      time: now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    };
    set(child(ref(db, 'memories'), String(id)), entry)
      .catch((err) => console.error("Firebase memory save error:", err));
    setFormImage(null);
    setFormTitle("");
    setFormDesc("");
    setFormAuthor("él");
    setShowForm(false);
    spawnHearts(formAuthor === "ella" ? "gold" : "crimson");
  };

  const deleteMemory = async (id: number) => {
    // Delete image from Firebase Storage
    try {
      const imgRef = storageRef(storage, `memories/${id}`);
      await deleteObject(imgRef);
    } catch (err: any) {
      if (err.code !== 'storage/object-not-found') {
        console.error("Firebase storage delete error:", err);
      }
    }
    // Delete entry from Firebase RTDB
    remove(child(ref(db, 'memories'), String(id)))
      .catch((err) => console.error("Firebase memory remove error:", err));
  };

  // Messages / Poems state (Reconciliation chat)
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [msgAuthor, setMsgAuthor] = useState<"él" | "ella">("él");
  const [reconTab, setReconTab] = useState<"carta" | "mensajes">("carta");
  const [notificationPerm, setNotificationPerm] = useState<NotificationPermission | null>(null);

  // Listen for real-time messages from Firebase
  useEffect(() => {
    const messagesRef = ref(db, 'messages');

    // Migrate existing localStorage messages to Firebase
    const stored = localStorage.getItem("carta_messages");
    if (stored) {
      try {
        const localMessages = JSON.parse(stored) as MessageEntry[];
        if (localMessages.length > 0) {
          localMessages.forEach((msg) => {
            set(child(messagesRef, String(msg.id)), msg)
              .catch((err) => console.error("Firebase migration error:", err));
          });
        }
        localStorage.removeItem("carta_messages");
      } catch {}
    }

    // Listen for real-time updates
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({
          ...data[key],
        })) as MessageEntry[];
        list.sort((a, b) => a.id - b.id);
        setMessages(list);
      } else {
        setMessages([]);
      }
    }, (err) => {
      console.error("Firebase listener error:", err);
    });

    return unsubscribe;
  }, []);

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check if mobile (notifications don't work on mobile browsers)
  const isMobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Request notification permission (only on desktop)
  const requestNotifPermission = async () => {
    if (!("Notification" in window) || isMobile) return;
    const perm = await Notification.requestPermission();
    setNotificationPerm(perm);
  };

  // Send a message (real-time via Firebase)
  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const now = new Date();
    const id = Date.now();
    const entry: MessageEntry = {
      id,
      text: newMessage.trim(),
      author: msgAuthor,
      date: now.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }),
      time: now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    };
    set(child(ref(db, 'messages'), String(id)), entry)
      .then(() => {
        setToastMsg("");
      })
      .catch((err) => {
        console.error("Firebase send error:", err);
        setToastMsg("Error al enviar. Revisa las reglas de Firebase DB.");
        setTimeout(() => setToastMsg(""), 5000);
      });
    setNewMessage("");

    // Show notification to the partner (desktop only)
    if (!isMobile && "Notification" in window && Notification.permission === "granted") {
      new Notification("💌 Nuevo mensaje de " + (msgAuthor === "él" ? "Él" : "Ella"), {
        body: entry.text.length > 100 ? entry.text.slice(0, 100) + "..." : entry.text,
        icon: "/favicon.ico",
      });
    }

    spawnHearts(msgAuthor === "ella" ? "gold" : "crimson");
  };

  const deleteMessage = (id: number) => {
    remove(child(ref(db, 'messages'), String(id)))
      .catch((err) => console.error("Firebase remove error:", err));
  };

  // Couple time delta state
  const [timeTogether, setTimeTogether] = useState<TimeDelta>({
    years: 0,
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const synthRef = useRef<any>(null);

  // 1. Calculate time together in real-time
  useEffect(() => {
    // Start date: Nov 15, 2025 at 00:00:00 (6 Months Anniversary)
    const startDate = new Date('2025-11-15T00:00:00');
    
    const calculateTime = () => {
      const now = new Date();
      const diff = now.getTime() - startDate.getTime();
      
      const totalSecs = Math.floor(diff / 1000);
      const totalMins = Math.floor(totalSecs / 60);
      const totalHours = Math.floor(totalMins / 60);
      const totalDays = Math.floor(totalHours / 24);
      
      const seconds = totalSecs % 60;
      const minutes = totalMins % 60;
      const hours = totalHours % 24;
      
      // Calculate years and remaining days
      const years = Math.floor(totalDays / 365);
      const remainingDays = totalDays % 365;
      
      // Approximate months and remaining days
      const months = Math.floor(remainingDays / 30);
      const days = remainingDays % 30;

      setTimeTogether({ years, months, days, hours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Generate floating background particles
  useEffect(() => {
    const list: Particle[] = Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 4 + 2}px`,
      drift: `${Math.random() * 80 - 40}px`,
      delay: `${Math.random() * 8}s`,
      duration: `${Math.random() * 10 + 12}s`,
    }));
    setParticles(list);
  }, []);

  // 3. Spotlight tracker (follows pointer)
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      let x = 50;
      let y = 50;
      if ('touches' in e && e.touches.length > 0) {
        x = (e.touches[0].clientX / window.innerWidth) * 100;
        y = (e.touches[0].clientY / window.innerHeight) * 100;
      } else if ('clientX' in e) {
        x = (e.clientX / window.innerWidth) * 100;
        y = (e.clientY / window.innerHeight) * 100;
      }
      document.documentElement.style.setProperty('--mouse-x', `${x}%`);
      document.documentElement.style.setProperty('--mouse-y', `${y}%`);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove);
    
    const bannerTimer = setTimeout(() => {
      setAudioBanner(true);
    }, 2500);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      clearTimeout(bannerTimer);
    };
  }, []);

  // 4. Synthesizer Setup (Web Audio API in C Minor/Eb Major)
  const initSynth = () => {
    if (synthRef.current) return;

    class AmbientSynth {
      ctx: AudioContext | null = null;
      oscillators: OscillatorNode[] = [];
      gainNodes: GainNode[] = [];
      filter: BiquadFilterNode | null = null;
      masterGain: GainNode | null = null;
      isPlaying = false;
      chordIndex = 0;
      timerId: any = null;

      init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(280, this.ctx.currentTime);
        this.filter.Q.setValueAtTime(1.2, this.ctx.currentTime);
        
        this.filter.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }

      play() {
        this.init();
        if (!this.ctx || this.isPlaying) return;
        
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        
        this.isPlaying = true;
        const now = this.ctx.currentTime;
        this.masterGain!.gain.cancelScheduledValues(now);
        this.masterGain!.gain.linearRampToValueAtTime(0.14, now + 4);

        this.playNextChord();
      }

      stop() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        
        const now = this.ctx?.currentTime || 0;
        if (this.masterGain && this.ctx) {
          this.masterGain.gain.cancelScheduledValues(now);
          this.masterGain.gain.linearRampToValueAtTime(0, now + 2.5);
        }
        
        if (this.timerId) {
          clearTimeout(this.timerId);
          this.timerId = null;
        }
        
        const oscsToStop = [...this.oscillators];
        setTimeout(() => {
          if (!this.isPlaying) {
            oscsToStop.forEach(osc => {
              try { osc.stop(); } catch(e) {}
            });
            this.oscillators = [];
            this.gainNodes = [];
          }
        }, 3000);
      }

      playNextChord() {
        if (!this.isPlaying || !this.ctx || !this.filter) return;
        
        const chords = [
          [44, 51, 55, 60, 63], // AbMaj7 (Ab2, Eb3, G3, C4, Eb4)
          [36, 43, 50, 58, 62], // Cm9 (C2, G2, D3, Bb3, D4)
          [39, 46, 50, 55, 58], // EbMaj7 (Eb2, Bb2, D3, G3, Bb3)
          [38, 45, 53, 57, 62]  // Bb6/D (D2, A2, F3, A3, D4)
        ];
        
        const midiNotes = chords[this.chordIndex];
        const now = this.ctx.currentTime;
        
        const oldGains = [...this.gainNodes];
        const oldOscs = [...this.oscillators];
        
        oldGains.forEach(gain => {
          if (gain) {
            gain.gain.cancelScheduledValues(now);
            gain.gain.linearRampToValueAtTime(0, now + 3);
          }
        });
        
        setTimeout(() => {
          oldOscs.forEach(osc => {
            try { osc.stop(); } catch(e) {}
          });
        }, 3200);
        
        this.oscillators = [];
        this.gainNodes = [];
        
        this.filter.frequency.cancelScheduledValues(now);
        this.filter.frequency.setValueAtTime(240, now);
        this.filter.frequency.exponentialRampToValueAtTime(420, now + 4);
        this.filter.frequency.exponentialRampToValueAtTime(240, now + 8);
        
        midiNotes.forEach(midi => {
          if (!this.ctx) return;
          const freq = 440 * Math.pow(2, (midi - 69) / 12);
          
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          osc.detune.setValueAtTime(Math.random() * 8 - 4, now);
          
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.065, now + 2.5);
          
          osc.connect(gain);
          gain.connect(this.filter!);
          
          osc.start(now);
          this.oscillators.push(osc);
          this.gainNodes.push(gain);
        });
        
        this.chordIndex = (this.chordIndex + 1) % chords.length;
        this.timerId = setTimeout(() => this.playNextChord(), 8000);
      }
    }

    synthRef.current = new AmbientSynth();
  };

  const toggleMute = () => {
    initSynth();
    if (isMuted) {
      synthRef.current.play();
      setIsMuted(false);
    } else {
      synthRef.current.stop();
      setIsMuted(true);
    }
    setAudioBanner(false);
  };

  const acceptAudio = () => {
    initSynth();
    synthRef.current.play();
    setIsMuted(false);
    setAudioBanner(false);
  };

  // 5. Sealed Envelope opening mechanism
  const handleOpenEnvelope = () => {
    if (isMuted) {
      initSynth();
      synthRef.current.play();
      setIsMuted(false);
      setAudioBanner(false);
    }
    
    setIsOpen(true);
    
    setTimeout(() => {
      setLetterVisible(true);
      setTimeout(() => {
        setLetterActive(true);
        revealParagraphs();
      }, 100);
    }, 600);

    setTimeout(() => {
      setEnvelopeFading(true);
    }, 1100);
  };

  const revealParagraphs = () => {
    const totalParas = 4;
    let current = 0;
    
    const interval = setInterval(() => {
      current += 1;
      setParaCount(current);
      
      if (current >= totalParas) {
        clearInterval(interval);
        setTimeout(() => {
          setButtonsVisible(true);
        }, 1500);
      }
    }, 2800);
  };

  // 6. Emitter system for hearts (crimson / gold)
  const spawnHearts = (colorType: "crimson" | "gold" = "crimson") => {
    const burst = Array.from({ length: 45 }).map((_, i) => {
      const left = Math.random() * 100;
      const size = Math.random() * 24 + 12;
      const driftX = (Math.random() * 80 - 40) + 'px';
      const endX = (Math.random() * 260 - 130) + 'px';
      const angle = (Math.random() * 50 - 25) + 'deg';
      const endAngle = (Math.random() * 200 - 100) + 'deg';
      const delay = (Math.random() * 1.8) + 's';
      
      return {
        id: Date.now() + i,
        left: `${left}%`,
        size: `${size}px`,
        driftX,
        endX,
        angle,
        endAngle,
        delay,
        colorType
      };
    });
    setHearts(burst);

    setTimeout(() => {
      setHearts([]);
    }, 4500);
  };

  const handleAction = (type: "hug" | "understand" | "promise") => {
    setFeedbackType(type);
    setFeedbackActive(true);
    spawnHearts(type === "promise" ? "gold" : "crimson");
  };

  const closeFeedback = () => {
    setFeedbackActive(false);
  };

  // 7. Navbar smooth tab transition
  const handleViewChange = (newView: typeof view) => {
    setView(newView);
    localStorage.setItem("carta_view", newView);
    // Start background music on active action if not already playing
    if (isMuted && newView !== "reconciliations") {
      initSynth();
      synthRef.current.play();
      setIsMuted(false);
      setAudioBanner(false);
    }
  };

  return (
    <div className="viewport-container">
      {/* Tactile analog grain overlay */}
      <div className="grain-overlay" />
      
      {/* Spotlight tracker color radial layer */}
      <div className="bg-gradient-glow" />

      {/* Floating particles */}
      <div className="particles-container">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
              '--drift': p.drift,
            } as any}
          />
        ))}
      </div>

      {/* Floating capsule Glassmorphism Navbar */}
      <nav className="floating-navbar">
        <button 
          className={`nav-item ${view === 'profile' ? 'active' : ''}`} 
          onClick={() => handleViewChange('profile')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          <span className="nav-label">Perfil</span>
        </button>
        <button 
          className={`nav-item ${view === 'mesarios' ? 'active' : ''}`} 
          onClick={() => handleViewChange('mesarios')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>
          <span className="nav-label">Mesarios</span>
        </button>
        <button 
          className={`nav-item ${view === 'reconciliations' ? 'active' : ''}`} 
          onClick={() => handleViewChange('reconciliations')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          <span className="nav-label">Reconciliación</span>
        </button>
        <button 
          className={`nav-item ${view === 'anniversaries' ? 'active' : ''}`} 
          onClick={() => handleViewChange('anniversaries')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 6h2v2h-2zm0 4h2v2h-2z"/></svg>
          <span className="nav-label">Aniversario</span>
        </button>
        <button 
          className={`nav-item ${view === 'photos' ? 'active' : ''}`} 
          onClick={() => handleViewChange('photos')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          <span className="nav-label">Diario</span>
        </button>
        <button 
          className={`nav-item music-item ${!isMuted ? 'active' : ''}`} 
          onClick={toggleMute}
          title={isMuted ? "Activar música" : "Silenciar"}
        >
          {isMuted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/><path d="M17.66 5.34l1.32-1.32C20.9 5.95 22 8.36 22 11s-1.1 5.05-3.02 6.98l-1.32-1.32C19.1 15.2 20 13.2 20 11s-.9-4.2-2.34-5.66z"/></svg>
          )}
          <span className="nav-label">{isMuted ? "Música" : "ON"}</span>
        </button>
      </nav>

      {/* ==========================================================================
         SPA ROUTED PORTAL VIEWS
         ========================================================================== */}
      <div className="view-transition-container" key={view}>
        
        {/* VIEW 1: COUPLES PROFILE (PERFIL) */}
        {view === "profile" && (
          <div className="profile-container">
            <header style={{ textAlign: 'center' }}>
              <span className="profile-tag">Nuestra Identidad</span>
              <h2 className="letter-title" style={{ margin: 0 }}>Nuestros Perfiles</h2>
            </header>

            <div className="profile-cards-grid">
              {/* Card 1: Él */}
              <div className="profile-card">
                <div className="profile-avatar-wrapper">
                  <span style={{ fontSize: '2.5rem' }}>👑</span>
                </div>
                <h3 className="profile-name">Él</h3>
                <span className="profile-tag">El chico de las espinas</span>
                <p className="profile-bio">
                  "Luchando cada día por aprender a quererte mejor, superar mis propios límites y cuidarte como te mereces."
                </p>
                <div className="profile-details-list">
                  <div className="profile-detail-item">
                    <span>Zodiaco:</span>
                    <span>Aries ♈</span>
                  </div>
                  <div className="profile-detail-item">
                    <span>Mi Rol:</span>
                    <span>Protegerte ❤️</span>
                  </div>
                  <div className="profile-detail-item">
                    <span>Mayor Deseo:</span>
                    <span>Hacerte feliz ✨</span>
                  </div>
                </div>
              </div>

              {/* Heart Connector */}
              <div className="profile-heart-connector">
                <div className="heart-pulse-3d" onClick={() => spawnHearts("crimson")}>❤️</div>
                <span className="profile-heart-label">Amor Real</span>
              </div>

              {/* Card 2: Ella */}
              <div className="profile-card">
                <div className="profile-avatar-wrapper">
                  <span style={{ fontSize: '2.5rem' }}>🌹</span>
                </div>
                <h3 className="profile-name">Ella</h3>
                <span className="profile-tag">Mi refugio eterno</span>
                <p className="profile-bio">
                  "La paciencia que calma mis tormentas, el abrazo que me reconstruye y el amor incondicional que me inspira."
                </p>
                <div className="profile-details-list">
                  <div className="profile-detail-item">
                    <span>Zodiaco:</span>
                    <span>Géminis ♊</span>
                  </div>
                  <div className="profile-detail-item">
                    <span>Mi Rol:</span>
                    <span>Compañera de vida 🫂</span>
                  </div>
                  <div className="profile-detail-item">
                    <span>Mayor Deseo:</span>
                    <span>Caminar juntos 🛤️</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Together Live Counter */}
            <div className="countdown-wrapper">
              <h3 className="countdown-title">El tiempo que llevamos construyéndonos...</h3>
              <div className="countdown-grid">
                <div className="countdown-item">
                  <span className="countdown-number">{timeTogether.years}</span>
                  <span className="countdown-label">Años</span>
                </div>
                <div className="countdown-item">
                  <span className="countdown-number">{timeTogether.months}</span>
                  <span className="countdown-label">Meses</span>
                </div>
                <div className="countdown-item">
                  <span className="countdown-number">{timeTogether.days}</span>
                  <span className="countdown-label">Días</span>
                </div>
                <div className="countdown-item">
                  <span className="countdown-number">{timeTogether.hours}</span>
                  <span className="countdown-label">Horas</span>
                </div>
                <div className="countdown-item">
                  <span className="countdown-number">{timeTogether.minutes}</span>
                  <span className="countdown-label">Min</span>
                </div>
                <div className="countdown-item">
                  <span className="countdown-number">{timeTogether.seconds}</span>
                  <span className="countdown-label">Seg</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MONTHLY MILESTONES (MESARIOS) */}
        {view === "mesarios" && (
          <div className="mesarios-container">
            <header className="mesarios-header">
              <span className="mesarios-subtitle">Nuestra Cronología</span>
              <h2 className="mesarios-title">Milestones de Amor</h2>
            </header>

            <div className="timeline-flow">
              {/* Milestone 1 */}
              <div className="timeline-checkpoint">
                <div className="timeline-bullet">1</div>
                <div className="timeline-card-wrapper">
                  <h4 className="timeline-card-title">
                    <span>El Comienzo (UTP)</span>
                    <span className="timeline-card-date">15 de Noviembre</span>
                  </h4>
                  <p className="timeline-card-text">
                    Nos conocimos en las aulas de la universidad de la UTP, gracias a nuestra gran amiga Carmen. Aquel hermoso e inesperado instante en que nuestras miradas y caminos se cruzaron dio inicio a todo este maravilloso lío de amor.
                  </p>
                </div>
              </div>

              {/* Milestone 2 */}
              <div className="timeline-checkpoint">
                <div className="timeline-bullet">3</div>
                <div className="timeline-card-wrapper">
                  <h4 className="timeline-card-title">
                    <span>Confidencias en la Noche</span>
                    <span className="timeline-card-date">Mes 3</span>
                  </h4>
                  <p className="timeline-card-text">
                    Las horas se hacían minutos hablando sin dormir. Descubrimos que nuestras mentes y almas encajaban como piezas perfectas de un mismo puzzle.
                  </p>
                </div>
              </div>

              {/* Milestone 3 */}
              <div className="timeline-checkpoint">
                <div className="timeline-bullet">6</div>
                <div className="timeline-card-wrapper">
                  <h4 className="timeline-card-title">
                    <span>Nuestro Presente (6 Meses)</span>
                    <span className="timeline-card-date">15 de Mayo</span>
                  </h4>
                  <p className="timeline-card-text">
                    ¡Medio año juntos! Seis meses coleccionando sonrisas y superando juntos las primeras espinas y tormentas. Hoy confirmamos que no queremos estar con nadie más en este mundo.
                  </p>
                </div>
              </div>

              {/* Milestone 4 */}
              <div className="timeline-checkpoint">
                <div className="timeline-bullet">9</div>
                <div className="timeline-card-wrapper">
                  <h4 className="timeline-card-title">
                    <span>El Futuro que Soñamos</span>
                    <span className="timeline-card-date">Mes 9</span>
                  </h4>
                  <p className="timeline-card-text">
                    La hermosa promesa de seguir aprendiendo que amar no es solo sonreír en los momentos felices, sino sostenernos con fuerza y paciencia en los silencios y días oscuros.
                  </p>
                </div>
              </div>

              {/* Milestone 5 */}
              <div className="timeline-checkpoint">
                <div className="timeline-bullet">12</div>
                <div className="timeline-card-wrapper">
                  <h4 className="timeline-card-title">
                    <span>Camino al Primer Año</span>
                    <span className="timeline-card-date">Mes 12</span>
                  </h4>
                  <p className="timeline-card-text">
                    El gran sueño de completar doce meses de risas, de sostenernos el alma, de perdonar y de elegirnos por encima de todo. Un año entero de ser mi persona favorita.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: RECONCILIACIONES - CARTA + MENSAJES */}
        {view === "reconciliations" && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Sub-navigation: Carta | Mensajes */}
            <div className="recon-subnav">
              <button
                className={`recon-subnav-btn ${reconTab === 'carta' ? 'active' : ''}`}
                onClick={() => setReconTab('carta')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/>
                </svg>
                Carta
              </button>
              <button
                className={`recon-subnav-btn ${reconTab === 'mensajes' ? 'active' : ''}`}
                onClick={() => {
                  setReconTab('mensajes');
                  if (!notificationPerm) requestNotifPermission();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
                Mensajes
                {messages.some(m => m.author === (msgAuthor === "él" ? "ella" : "él")) && (
                  <span className="recon-msg-dot" />
                )}
              </button>
            </div>

            {/* TAB: CARTA (existing letter experience) */}
            {reconTab === "carta" && (
              <>
                {/* 3D Sealed Envelope */}
                <div className={`envelope-wrapper ${isOpen ? 'open-anim' : ''} ${envelopeFading ? 'hidden' : ''}`}>
                  <div className="envelope" onClick={handleOpenEnvelope}>
                    <div className="envelope-flap-left" />
                    <div className="envelope-flap-right" />
                    <div className="envelope-flap-bottom" />
                    <div className="envelope-flap-top" />
                    
                    <div className="wax-seal-container">
                      <div className="wax-seal">
                        <div className="wax-seal-pulse" />
                        <svg width="24" height="24" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>
                      <span className="seal-label">Toca para abrir</span>
                    </div>
                  </div>
                </div>

                {/* Letter Card */}
                <div className={`letter-card-container ${letterVisible ? 'visible' : ''} ${letterActive ? 'active' : ''}`}>
                  <article className="letter-card">
                    <header>
                      <h1 className="letter-title">Mi Amor...</h1>
                      <p className="letter-subtitle">Desde el fondo de mi alma</p>
                    </header>

                    <div className="letter-content">
                      {/* Paragraph 1 */}
                      <p className={`letter-paragraph ${paraCount >= 1 ? 'paragraph-visible' : 'paragraph-hidden'}`}>
                        Perdón amor por todo, ya no sé cómo evitar hacerte sentir mal, <span className="highlight-red">más te amo más te hago daño 😔</span>, siento que soy una rama cn espinas y es muy doloroso soportarme lo sé amor ni yo me soporto ni yo me entiendo aveces.
                      </p>

                      {/* Poetic SVG drawing of the thorny branch */}
                      {paraCount >= 1 && (
                        <div className="thorny-decor-container" style={{ animation: 'paragraph-reveal 1.5s ease forwards' }}>
                          <svg className="thorny-svg" viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20,60 Q100,20 200,70 T380,45" stroke="#251214" strokeWidth="3" strokeLinecap="round"/>
                            <path d="M90,38 L85,25 L98,35 Z" fill="#800a0d" />
                            <path d="M150,50 L158,62 L146,55 Z" fill="#800a0d" />
                            <path d="M220,70 L216,84 L228,75 Z" fill="#800a0d" />
                            <path d="M280,55 L285,42 L275,50 Z" fill="#800a0d" />
                            <path d="M330,48 L338,60 L326,52 Z" fill="#800a0d" />
                            <path d="M20,60 Q100,20 200,70 T380,45" stroke="#a91015" strokeWidth="1.2" strokeLinecap="round" opacity="0.65"/>
                            
                            <g transform="translate(378, 43)">
                              <path d="M0,0 C-6,-8 -12,-4 -12,4 C-12,12 0,20 0,22 C0,22 12,12 12,4 C12,-4 6,-8 0,0 Z" fill="url(#roseGlow)"/>
                              <circle cx="0" cy="4" r="1.5" fill="#fff" opacity="0.7"/>
                            </g>
                            
                            <defs>
                              <radialGradient id="roseGlow" cx="0%" cy="0%" r="100%">
                                <stop offset="0%" stopColor="#ff4d52" />
                                <stop offset="70%" stopColor="#a91015" />
                                <stop offset="100%" stopColor="#300103" />
                              </radialGradient>
                            </defs>
                          </svg>
                        </div>
                      )}

                      {/* Paragraph 2 */}
                      <p className={`letter-paragraph ${paraCount >= 2 ? 'paragraph-visible' : 'paragraph-hidden'}`}>
                        Siento que te hago peor y lo siento y perdón también 😔, creo q te cansarás de mi por todo este lío 🥺😔, no se q me pasa, cuanto más quiero cuidarte más te hago sentir mal, peor...
                      </p>

                      {/* Paragraph 3 - Highlighted quote block */}
                      <div className={`letter-paragraph ${paraCount >= 3 ? 'paragraph-visible' : 'paragraph-hidden'}`}>
                        <blockquote className="highlight-quote">
                          "SIENTO Q NO ESTOY PARA UNA RELACIÓN"
                          <span style={{ display: 'block', fontSize: '0.78rem', marginTop: '8px', opacity: 0.8, fontWeight: 400, fontStyle: 'normal', fontFamily: 'var(--font-sans)', letterSpacing: '0.05em' }}>
                            (como tú misma lo dijiste y piensas)
                          </span>
                        </blockquote>
                        <p style={{ textAlign: 'justify', opacity: 0.95 }}>
                          y no sé cómo hacer q eso no sea así, te amo mucho enserio pero yo no sé si estoy haciendo bien hacía ti haciéndote esto, mucho te pido lo se 🥺😞.
                        </p>
                      </div>

                      {/* Paragraph 4 */}
                      <p className={`letter-paragraph ${paraCount >= 4 ? 'paragraph-visible' : 'paragraph-hidden'}`}>
                        Espero q no tengas rencor hacia mi amor 😞, espero q no ye arrepientas de mi l tal vez si cambies de opinión 🥺🫂 <span className="highlight-red">te amo mucho y perdón mi amor 😞😞🥺🫂</span>.
                      </p>
                    </div>

                    {paraCount >= 4 && (
                      <footer className="letter-footer" style={{ animation: 'paragraph-reveal 1.5s ease forwards' }}>
                        <div style={{ width: '40px', height: '1px', backgroundColor: 'rgba(169, 16, 21, 0.4)', margin: '12px 0' }} />
                        <span className="signature">Siempre Tuyo</span>
                      </footer>
                    )}

                    <div className={`interactive-section ${buttonsVisible ? 'visible' : ''}`}>
                      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>Responder con amor</span>
                      <div className="action-buttons-group">
                        <button className="btn-primary" onClick={() => handleAction("hug")}>
                          <span style={{ fontSize: '1.1rem' }}>🫂</span> UN ABRAZO VIRTUAL
                        </button>
                        <button className="btn-secondary" onClick={() => handleAction("understand")}>
                          <span style={{ fontSize: '1.1rem' }}>❤️</span> TE ENTIENDO, AMOR
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              </>
            )}

            {/* TAB: MENSAJES (bidirectional poem/message system) */}
            {reconTab === "mensajes" && (
              <div className="mensajes-container">
                <header className="mensajes-header">
                  <span className="mesarios-subtitle">Nuestras Palabras</span>
                  <h2 className="letter-title" style={{ margin: 0 }}>Mensajes y Poemas</h2>
                  <p className="diario-subheader">
                    Escríbanse lo que sienten, dedíquense poemas, guarden cada palabra...
                  </p>
                </header>

                {/* Messages feed */}
                <div className="mensajes-feed">
                  {messages.length === 0 ? (
                    <div className="mensajes-empty">
                      <div className="mensajes-empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                        </svg>
                      </div>
                      <p className="mensajes-empty-text">Aún no hay mensajes...</p>
                      <p className="mensajes-empty-sub">El primer poema, la primera palabra, comienza aquí.</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`mensaje-bubble ${msg.author === 'ella' ? 'bubble-ella' : 'bubble-el'}`}>
                        <div className="mensaje-bubble-header">
                          <span className="mensaje-bubble-author">
                            {msg.author === 'él' ? '👑 Él' : '🌹 Ella'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="mensaje-bubble-time">{msg.date} · {msg.time}</span>
                            <button
                              className="mensaje-delete-btn"
                              onClick={() => deleteMessage(msg.id)}
                              title="Eliminar"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                        <p className="mensaje-bubble-text">{msg.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <div ref={messagesEndRef} />

                {/* Compose message (at bottom like WhatsApp) */}
                <div className="mensajes-compose">
                  <div className="mensajes-author-toggle">
                    <button
                      className={`mensajes-author-btn ${msgAuthor === 'él' ? 'active-él' : ''}`}
                      onClick={() => setMsgAuthor('él')}
                    >
                      👑 Él escribe
                    </button>
                    <button
                      className={`mensajes-author-btn ${msgAuthor === 'ella' ? 'active-ella' : ''}`}
                      onClick={() => {
                        setMsgAuthor('ella');
                        if (!notificationPerm) requestNotifPermission();
                      }}
                    >
                      🌹 Ella escribe
                    </button>
                  </div>
                  <textarea
                    className="mensajes-textarea"
                    placeholder="Escribe un poema, un mensaje, lo que quieras decirle..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    rows={3}
                    maxLength={1000}
                  />
                  <div className="mensajes-compose-footer">
                    <span className="mensajes-count">{newMessage.length}/1000</span>
                    <button
                      className="mensajes-send-btn"
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                      ENVIAR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: ANIVERSARIO GOLD METALLIC CARD */}
        {view === "anniversaries" && (
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <article className="letter-card anniversary-card-gold" style={{ opacity: 1, pointerEvents: 'auto' }}>
              <header>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '2.8rem', filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.6))' }}>🏆</span>
                </div>
                <h1 className="letter-title text-gold-highlight">6 Meses Juntos</h1>
                <p className="letter-subtitle" style={{ color: 'var(--gold-metallic)', opacity: 0.8 }}>15 de Noviembre — Medio Año de Amor</p>
              </header>

              <div className="letter-content">
                <p className="letter-paragraph">
                  <span className="text-gold-highlight">Mi amor eterno, hoy celebramos nuestros primeros 6 meses juntos.</span> Medio año entero en el cual he descubierto la inmensidad de tu corazón, la luz que traes a mis días y lo valioso que es caminar a tu lado.
                </p>
                
                <p className="letter-paragraph">
                  Sé perfectamente que no ha sido un camino libre de dificultades. Sé que a veces me he sentido como una <span className="highlight-red">rama llena de espinas</span>, y que tolerarme e intentar entenderme requiere una fuerza inmensa. Perdóname por las veces que te he hecho daño o te he hecho dudar.
                </p>

                <blockquote className="highlight-quote gold-quote">
                  "Medio año entero de aprender a sanar, crecer y amarte con cada parte de mi ser."
                </blockquote>

                <p className="letter-paragraph">
                  Gracias por tu paciencia infinita, por la calidez de tus abrazos y por elegir no soltarme cuando las tormentas soplan con fuerza. Prometo seguir puliendo mis espinas y esforzarme cada día por ser el refugio seguro que tú te mereces. Feliz Medio Aniversario, mi vida entera. ❤️
                </p>
              </div>

              <footer className="letter-footer">
                <div style={{ width: '40px', height: '1px', backgroundColor: 'var(--gold-metallic)', margin: '12px 0' }} />
                <span className="signature" style={{ color: 'var(--gold-metallic)' }}>Con Amor Eterno</span>
              </footer>

              <div className="interactive-section visible" style={{ marginTop: '24px' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--gold-metallic)', letterSpacing: '0.2em' }}>Nuestra Alianza</span>
                <button className="btn-primary btn-gold" onClick={() => handleAction("promise")}>
                  ✨ RENOVAR NUESTRA PROMESA
                </button>
              </div>
            </article>
          </div>
        )}

        {/* VIEW 5: SHARED JOURNAL / MEMORY WALL (DIARIO COMPARTIDO) */}
        {view === "photos" && (
          <div className="diario-container">
            <header className="diario-header">
              <span className="mesarios-subtitle">Nuestro Diario</span>
              <h2 className="letter-title" style={{ margin: 0 }}>Memorias Compartidas</h2>
              <p className="diario-subheader">
                Cada foto, cada palabra, cada instante que vivimos juntos...
              </p>
            </header>

            {/* Add Memory Button */}
            <button className="diario-add-btn" onClick={() => setShowForm(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              NUEVO RECUERDO
            </button>

            {/* Create Memory Form */}
            <div className={`diario-form-overlay ${showForm ? 'active' : ''}`} onClick={() => setShowForm(false)}>
              <div className="diario-form-card" onClick={e => e.stopPropagation()}>
                <button className="diario-form-close" onClick={() => setShowForm(false)}>✕</button>
                <h3 className="diario-form-title">Capturar un Momento</h3>

                <div className="diario-form-group">
                  <label className="diario-form-label">¿Quién eres?</label>
                  <div className="diario-form-author-toggle">
                    <button
                      className={`diario-author-btn ${formAuthor === 'él' ? 'active-él' : ''}`}
                      onClick={() => setFormAuthor('él')}
                    >
                      👑 Él
                    </button>
                    <button
                      className={`diario-author-btn ${formAuthor === 'ella' ? 'active-ella' : ''}`}
                      onClick={() => setFormAuthor('ella')}
                    >
                      🌹 Ella
                    </button>
                  </div>
                </div>

                <div className="diario-form-group">
                  <label className="diario-form-label">Foto del momento</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                  {formImage ? (
                    <div className="diario-image-preview" onClick={() => fileInputRef.current?.click()}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={formImage} alt="Preview" />
                      <span className="diario-image-change">Cambiar foto</span>
                    </div>
                  ) : (
                    <div className="diario-image-upload" onClick={() => fileInputRef.current?.click()}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                      </svg>
                      <span>Toca para subir una foto</span>
                    </div>
                  )}
                </div>

                <div className="diario-form-group">
                  <label className="diario-form-label">Título del recuerdo</label>
                  <input
                    className="diario-form-input"
                    type="text"
                    placeholder="¿Qué hicimos?"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    maxLength={60}
                  />
                </div>

                <div className="diario-form-group">
                  <label className="diario-form-label">¿Qué pasó? Cuéntalo...</label>
                  <textarea
                    className="diario-form-textarea"
                    placeholder="Escribe aquí lo que viviste, lo que sentiste..."
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    rows={4}
                    maxLength={500}
                  />
                  <span className="diario-form-count">{formDesc.length}/500</span>
                </div>

                <button
                  className="diario-form-submit"
                  onClick={addMemory}
                  disabled={!formImage || !formTitle.trim() || !formDesc.trim()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  GUARDAR RECUERDO
                </button>
              </div>
            </div>

            {/* Memory Feed */}
            <div className="diario-feed">
              {memories.length === 0 ? (
                <div className="diario-empty">
                  <div className="diario-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                  </div>
                  <p className="diario-empty-text">Aún no hay recuerdos...</p>
                  <p className="diario-empty-sub">¡Empieza a llenar nuestro diario con los momentos que vivimos juntos!</p>
                </div>
              ) : (
                memories.map((memory) => (
                  <div key={memory.id} className={`memoria-card ${memory.author === 'ella' ? 'memoria-ella' : 'memoria-el'}`}>
                    <div className="memoria-card-header">
                      <div className="memoria-author">
                        <span className="memoria-avatar">
                          {memory.author === 'él' ? '👑' : '🌹'}
                        </span>
                        <div className="memoria-author-info">
                          <span className="memoria-author-name">
                            {memory.author === 'él' ? 'Él' : 'Ella'}
                          </span>
                          <span className="memoria-date">
                            {memory.date} · {memory.time}
                          </span>
                        </div>
                      </div>
                      <button
                        className="memoria-delete"
                        onClick={() => deleteMemory(memory.id)}
                        title="Eliminar recuerdo"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                      </button>
                    </div>

                    <div className="memoria-image-wrapper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={memory.imageData} alt={memory.title} loading="lazy" />
                    </div>

                    <div className="memoria-body">
                      <h4 className="memoria-title">{memory.title}</h4>
                      <p className="memoria-description">{memory.description}</p>
                    </div>

                    <div className="memoria-footer-bar">
                      <span className={`memoria-badge ${memory.author === 'ella' ? 'badge-ella' : 'badge-el'}`}>
                        {memory.author === 'él' ? '👑 Publicado por Él' : '🌹 Publicado por Ella'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* Floating Hearts Spray Layer */}
      <div className="heart-burst-layer">
        {hearts.map((h) => (
          <span
            key={h.id}
            className="floating-heart"
            style={{
              left: h.left,
              fontSize: h.size,
              animationDelay: h.delay,
              color: h.colorType === "gold" ? "#ffd700" : "#ff333a",
              filter: h.colorType === "gold" 
                ? "drop-shadow(0 0 8px rgba(255, 215, 0, 0.7))" 
                : "drop-shadow(0 0 6px rgba(255, 51, 58, 0.6))",
              '--drift-x': h.driftX,
              '--end-x': h.endX,
              '--angle': h.angle,
              '--end-angle': h.endAngle,
            } as any}
          >
            ❤️
          </span>
        ))}
      </div>

      {/* Response Overlay Dialog Feedbacks */}
      <div className={`feedback-overlay ${feedbackActive ? 'active' : ''}`}>
        <div className="feedback-card" style={{ borderColor: feedbackType === "promise" ? "var(--gold-metallic)" : "rgba(229, 62, 62, 0.45)" }}>
          <div className="feedback-icon" style={{ filter: feedbackType === "promise" ? "drop-shadow(0 0 15px rgba(212,175,55,0.7))" : "drop-shadow(0 0 10px rgba(255, 77, 82, 0.5))" }}>
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
                fill={feedbackType === "promise" ? "#d4af37" : "#ff4d52"} 
              />
            </svg>
          </div>
          
          {feedbackType === "hug" && (
            <>
              <h2 className="feedback-title">Abrazo Recibido... 🫂</h2>
              <p className="feedback-text">
                "Gracias por no soltarme... Prometo cuidar de ti, curar mis heridas y trabajar en cada una de mis espinas. Te amo más de lo que te imaginas."
              </p>
            </>
          )}

          {feedbackType === "understand" && (
            <>
              <h2 className="feedback-title">Gracias por Entender... ❤️</h2>
              <p className="feedback-text">
                "Sé que cometo errores y que es difícil, gracias por estar aquí a pesar de todo. Tu amor y comprensión son mi mayor refugio. Te amo muchísimo."
              </p>
            </>
          )}

          {feedbackType === "promise" && (
            <>
              <h2 className="feedback-title" style={{ color: 'var(--gold-metallic)' }}>Promesa Renovada ✨</h2>
              <p className="feedback-text">
                "Nuestra promesa de amor por estos 6 meses ha sido renovada con éxito. Medio año ha pasado y prometo seguir eligiéndote hoy, mañana y cada segundo de nuestras vidas. ¡Feliz Medio Aniversario!"
              </p>
            </>
          )}

          <button 
            className="btn-close" 
            onClick={closeFeedback}
            style={{ borderColor: feedbackType === "promise" ? "var(--gold-metallic)" : "rgba(169, 16, 21, 0.5)" }}
          >
            Volver a la carta
          </button>
        </div>
      </div>

      {/* Persistent Audio Reminder Toast */}
      <div className={`audio-banner ${audioBanner ? 'active' : ''}`}>
        <span className="audio-banner-text">🎵 Se recomienda activar la música para la experiencia</span>
        <button className="audio-banner-btn" onClick={acceptAudio}>Activar</button>
      </div>

      {/* PWA Install Banner */}
      <div className={`pwa-install-banner ${showInstallBanner ? 'active' : ''}`}>
        <div className="pwa-install-content">
          <span className="pwa-install-icon">📱</span>
          <div className="pwa-install-text">
            <span className="pwa-install-title">Instala Carta</span>
            <span className="pwa-install-sub">Guarda esta carta en tu pantalla como una app</span>
          </div>
          <button className="pwa-install-btn" onClick={handleInstall}>Instalar</button>
          <button className="pwa-install-close" onClick={() => setShowInstallBanner(false)}>✕</button>
        </div>
      </div>

      {/* Error Toast */}
      <div className={`error-toast ${toastMsg ? 'active' : ''}`}>{toastMsg}</div>
    </div>
  );
}
