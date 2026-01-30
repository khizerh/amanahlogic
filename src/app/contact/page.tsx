"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const slideUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const staggerForm = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const formField = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission — replace with real server action later
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setIsSuccess(true);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logos/logo-text.svg" alt="Amanah Logic" width={140} height={20} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/portal/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
              Member Login
            </Link>
            <Link href="/login" className="text-sm font-medium text-white bg-[#0638A8] hover:bg-[#021786] rounded-lg px-4 py-2 transition-colors">
              Admin Login
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <main className="flex-1 pt-12 pb-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeIn}
              className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-4"
            >
              Get in touch
            </motion.h1>
            <motion.p
              initial="hidden"
              animate="visible"
              variants={slideUp}
              className="text-lg text-gray-600 leading-relaxed"
            >
              Have questions? We&apos;d love to hear from you.
            </motion.p>
          </div>

          {/* Contact Form */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={slideUp}
          >
            {isSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-8 text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0638A8] text-white mb-6">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Thanks! We&apos;ll get back to you soon.
                </h2>
                <p className="text-gray-600">
                  We typically respond within 24 hours.
                </p>
              </motion.div>
            ) : (
              <motion.form
                onSubmit={handleSubmit}
                variants={staggerForm}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                {/* Name */}
                <motion.div variants={formField} className="space-y-2">
                  <Label htmlFor="name" className="text-gray-700">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Your name"
                    className="h-12 rounded-lg border-gray-300 bg-white px-4 text-gray-900 placeholder:text-gray-400 focus:border-[#0638A8] focus:ring-[#0638A8]"
                  />
                </motion.div>

                {/* Email */}
                <motion.div variants={formField} className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="h-12 rounded-lg border-gray-300 bg-white px-4 text-gray-900 placeholder:text-gray-400 focus:border-[#0638A8] focus:ring-[#0638A8]"
                  />
                </motion.div>

                {/* Message */}
                <motion.div variants={formField} className="space-y-2">
                  <Label htmlFor="message" className="text-gray-700">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    required
                    placeholder="How can we help you?"
                    rows={5}
                    className="rounded-lg border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-[#0638A8] focus:ring-[#0638A8] resize-none"
                  />
                </motion.div>

                {/* Submit */}
                <motion.div variants={formField} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 bg-[#0638A8] hover:bg-[#021786] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                        Sending...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Send Message
                        <Send className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </motion.div>
              </motion.form>
            )}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center md:items-start gap-1">
              <Image src="/logos/logo-icon-white.svg" alt="Amanah Logic" width={100} height={31} />
              <p className="text-sm mt-2">&copy; {new Date().getFullYear()} Amanah Logic. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
