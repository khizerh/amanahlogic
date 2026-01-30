"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Users, CreditCard, MapPin, Check } from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logos/logo-new.svg" alt="Amanah Logic" width={100} height={30} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="#features"
              className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
            >
              Features
            </Link>
            <Link
              href="/contact"
              className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
            >
              Contact
            </Link>
            <Link
              href="/portal/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
            >
              Member Login
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-white bg-[#111827] hover:bg-[#1f2937] rounded-lg px-4 py-2 transition-colors"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-100/70 via-amber-50/30 to-white" />
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ scale: [1, 1.15, 1], x: [0, 40, 0], y: [0, -30, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" as const }}
            className="absolute -top-10 left-[15%] w-[400px] h-[400px] bg-[#F8CC58]/35 rounded-full blur-[100px]"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], x: [0, -30, 0], y: [0, 40, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" as const }}
            className="absolute top-20 right-[10%] w-[350px] h-[350px] bg-amber-200/40 rounded-full blur-[100px]"
          />
          <motion.div
            animate={{ scale: [1.1, 1, 1.1], x: [0, 20, 0], y: [0, -20, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" as const }}
            className="absolute top-40 left-[40%] w-[300px] h-[300px] bg-[#F8CC58]/25 rounded-full blur-[120px]"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], x: [0, -40, 0], y: [0, 20, 0] }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" as const }}
            className="absolute -bottom-20 left-[20%] w-[500px] h-[300px] bg-amber-200/50 rounded-full blur-[100px]"
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-[#F8CC58]/15 px-4 py-2 text-sm font-medium text-gray-900 mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F8CC58]" />
              Membership Management Platform
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6"
          >
            <span className="block">Community Burial Benefits,</span>
            <span className="block text-gray-900">
              Managed Simply
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mx-auto max-w-2xl text-lg md:text-xl text-gray-600 leading-relaxed mb-10"
          >
            The all-in-one platform built for Muslim community organizations.
            Handle members, payments, plots, and agreements from a single dashboard.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/portal/login"
                className="inline-flex items-center gap-2 font-medium text-white bg-[#111827] hover:bg-[#1f2937] rounded-xl px-8 py-3.5 transition-colors shadow-lg shadow-gray-900/20"
              >
                Member Portal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 font-medium text-[#111827] bg-white border border-gray-300 hover:border-[#111827] rounded-xl px-8 py-3.5 transition-colors shadow-sm"
              >
                Admin Dashboard
              </Link>
            </motion.div>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500"
          >
            {["Secure payments via Stripe", "Member self-service portal", "Digital agreements"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#F8CC58]" />
                <span>{item}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-gray-100/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeIn}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-[#8F4D05] mb-3">
              Everything You Need
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Built for community organizations
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              {
                icon: Users,
                title: "Member Management",
                description: "Track members, dependents, and membership status with a complete member directory.",
              },
              {
                icon: CreditCard,
                title: "Payment Processing",
                description: "Collect dues online with Stripe. Automatic receipts, payment history, and reminders.",
              },
              {
                icon: MapPin,
                title: "Plot Management",
                description: "Manage graveyard plots, assignments, and availability with visual tracking.",
              },
              {
                icon: Shield,
                title: "Member Portal",
                description: "Members can view their profile, make payments, and access agreements online.",
              },
            ].map((feature) => (
              <motion.div
                key={feature.title}
                variants={staggerItem}
                whileHover={{ y: -4, borderColor: "rgba(248, 204, 88, 0.5)" }}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-amber-100/50"
              >
                <div className="h-12 w-12 rounded-xl bg-[#F8CC58]/15 flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-[#8F4D05]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 overflow-hidden">
        {/* Warm gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-100/80 via-orange-50/60 to-amber-50/70" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-[10%] w-[400px] h-[400px] bg-[#F8CC58]/30 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-[15%] w-[350px] h-[300px] bg-amber-200/35 rounded-full blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 mb-6">
              Ready to get started?
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-4 max-w-2xl mx-auto">
              Simplify how your organization manages memberships, payments, and burial plots.
            </p>
            <p className="text-sm text-gray-500 mb-10">
              Secure. Simple. Purpose-built for your community.
            </p>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#111827] hover:bg-[#1f2937] rounded-xl px-8 py-3.5 transition-colors shadow-lg shadow-gray-900/20"
              >
                Get In Touch
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

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
