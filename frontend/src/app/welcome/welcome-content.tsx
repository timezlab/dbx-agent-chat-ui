"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, TerminalIcon, ShieldIcon, LayersIcon, SparklesIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// Define our custom cubic-bezier easing for high-end feel
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export function WelcomeContent() {
  const reduce = useReducedMotion();

  // Animation variants
  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: EASE }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      }
    }
  };

  // Safe variants for when reduced motion is preferred
  const safeFadeUp = reduce ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4 } } } : fadeUp;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-hidden selection:bg-foreground/10">
      {/* High-end Ambient Background (Ethereal Glass / Soft Structuralism) */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-30 dark:opacity-40">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-foreground/5 rounded-full blur-[100px] mix-blend-normal" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-foreground/5 rounded-full blur-[100px] mix-blend-normal" />
      </div>

      <div className="relative z-10 px-6 md:px-12 max-w-[1400px] mx-auto pt-40 pb-24">
        {/* Hero Section */}
        <motion.section 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="flex flex-col items-start md:items-center md:text-center"
        >
          {/* Eyebrow - The "Pill" Tag */}
          <motion.div variants={safeFadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/[0.03] border border-foreground/[0.08] text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-8">
            <SparklesIcon className="size-3" strokeWidth={1.5} />
            <span>Enterprise AI Assistant</span>
          </motion.div>
          
          <motion.h1 
            variants={safeFadeUp}
            className="text-5xl md:text-7xl tracking-tighter leading-[1.05] max-w-4xl font-medium"
          >
            Your Data. Your Agent. <br className="hidden md:block" /> 
            <span className="text-muted-foreground">Unlocked.</span>
          </motion.h1>
          
          <motion.p 
            variants={safeFadeUp}
            className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-[65ch]"
          >
            The intelligent assistant that connects directly to your enterprise data. Ask questions, analyze trends, and automate workflows with enterprise-grade security.
          </motion.p>

          <motion.div variants={safeFadeUp} className="flex flex-col sm:flex-row items-center gap-4 mt-12 w-full sm:w-auto">
            {/* Primary CTA - Button in Button pattern */}
            <Link
              href="/"
              className="group relative inline-flex items-center justify-between gap-4 pl-6 pr-2 py-2 rounded-full bg-foreground text-background font-medium active:scale-[0.98] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] w-full sm:w-auto"
            >
              <span>Start Chatting</span>
              <div className="w-8 h-8 rounded-full bg-background/20 dark:bg-background/20 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                <ArrowRightIcon className="size-4" strokeWidth={1.25} />
              </div>
            </Link>

            {/* Secondary CTA */}
            <Link
              href="/docs"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-foreground/10 bg-transparent text-foreground font-medium hover:bg-foreground/5 transition-colors duration-300 active:scale-[0.98] w-full sm:w-auto"
            >
              Explore Capabilities
            </Link>
          </motion.div>
        </motion.section>

        {/* Bento Grid Features - Asymmetrical */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
          className="mt-32 grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          {/* Card 1 - Spans 8 cols */}
          <BentoCard 
            className="md:col-span-7 lg:col-span-8"
            icon={<LayersIcon className="size-5" strokeWidth={1.25} />}
            title="Deep Data Integration"
            desc="Securely connects to your Databricks lakehouse. Query millions of rows, generate visualizations, and extract actionable insights in seconds using natural language."
            delay={0.1}
          />
          
          {/* Card 2 - Spans 4 cols */}
          <BentoCard 
            className="md:col-span-5 lg:col-span-4"
            icon={<ShieldIcon className="size-5" strokeWidth={1.25} />}
            title="Enterprise Security"
            desc="Built with zero-trust architecture. Your data never leaves your environment, and role-based access controls are strictly enforced at every level."
            delay={0.2}
          />
          
          {/* Card 3 - Spans full width / wide */}
          <BentoCard 
            className="md:col-span-12"
            icon={<TerminalIcon className="size-5" strokeWidth={1.25} />}
            title="Automated Workflows"
            desc="Go beyond conversational chat. Create multi-step data pipelines, schedule recurring analytical reports, and let the agent perform complex tasks autonomously in the background."
            delay={0.3}
          />
        </motion.section>
      </div>
    </div>
  );
}

// Double-Bezel Architecture Card
function BentoCard({ 
  icon, 
  title, 
  desc, 
  className,
  delay
}: { 
  icon: React.ReactNode; 
  title: string; 
  desc: string; 
  className?: string;
  delay: number;
}) {
  const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
  const reduce = useReducedMotion();
  
  return (
    <motion.div 
      variants={{
        hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
        visible: { 
          opacity: 1, 
          y: 0, 
          transition: { duration: 0.8, ease: EASE, delay } 
        }
      }}
      className={cn(
        "group flex flex-col p-2 rounded-[2rem] bg-foreground/[0.02] border border-foreground/[0.05] relative overflow-hidden",
        className
      )}
    >
      {/* Inner Core */}
      <div className="flex flex-col flex-1 p-8 rounded-[calc(2rem-0.5rem)] bg-background border border-foreground/[0.03] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] transition-colors duration-500 group-hover:bg-foreground/[0.01]">
        
        {/* Icon Floating Island */}
        <div className="size-12 rounded-full bg-foreground/[0.03] flex items-center justify-center text-foreground border border-foreground/[0.05] mb-8 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110 group-hover:-translate-y-1">
          {icon}
        </div>
        
        <h3 className="text-xl lg:text-2xl font-medium tracking-tight text-foreground mb-4">
          {title}
        </h3>
        
        <p className="text-base text-muted-foreground leading-relaxed max-w-[65ch]">
          {desc}
        </p>
      </div>
    </motion.div>
  );
}
