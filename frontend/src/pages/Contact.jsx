import React, { useState } from "react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { submitContact } from "../lib/api";
import { toast } from "sonner";
import { SECTORS } from "../lib/data";
import usePageCopy from "../hooks/usePageCopy";
import { Phone, Mail, MessageSquare, Send, Sparkles } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

export default function Contact() {
  usePageTitle("Contact");
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "", quantity: "", sector: "" });
  const [submitting, setSubmitting] = useState(false);

  const copy = usePageCopy("contact", {
    title: "",
    subtitle: "Tell us what you need — we'll come back with a tailored quote, fabric advice and free logo design ideas.",
  });

  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill name, email and message.");
      return;
    }
    setSubmitting(true);
    try {
      await submitContact(form);
      toast.success("Thanks! We'll be in touch within 1 working day. 🌟");
      setForm({ name: "", email: "", phone: "", company: "", message: "", quantity: "", sector: "" });
    } catch {
      toast.error("Something went wrong. Please try again or email us.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="relative overflow-hidden">
        <div className="absolute -top-32 -right-20 w-[500px] h-[500px] rounded-full bg-[#7bc67e]/20 blur-3xl" />
        <div className="absolute top-0 -left-32 w-[400px] h-[400px] rounded-full bg-[#fde68a]/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f0fdf4] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs">
              <Sparkles size={14} className="text-[#7bc67e]" /> No pressure · No hard sell
            </div>
            <h1 className="font-nunito font-black text-4xl lg:text-6xl mt-4 leading-tight" data-testid="contact-hero-title">
              {copy.title ? copy.title : (<>Get a Quote.<br />Talk to a real human.</>)}
            </h1>
            <p className="text-[#4b5563] mt-5 max-w-md" data-testid="contact-hero-subtitle">{copy.subtitle}</p>
            <div className="mt-8 space-y-4">
              {[
                { icon: Phone, label: "Chat to a real human", val: "Mon–Fri · UK based" },
                { icon: Mail, label: "Email", val: "hello@yourownprint.co.uk" },
                { icon: MessageSquare, label: "Account management", val: "Large or complex orders welcome" },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="flex items-start gap-4">
                  <span className="w-11 h-11 rounded-full bg-[#7bc67e] grid place-items-center text-[#1a1a1a]"><Icon size={18} /></span>
                  <div>
                    <div className="font-nunito font-extrabold text-[#1a1a1a]">{label}</div>
                    <div className="text-sm text-[#4b5563]">{val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={onSubmit} className="lg:col-span-3 bg-white rounded-3xl border-2 border-[#dcfce7] p-6 lg:p-8 shadow-lg" data-testid="contact-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name *" value={form.name} onChange={update("name")} testId="contact-name" />
              <Field label="Email *" type="email" value={form.email} onChange={update("email")} testId="contact-email" />
              <Field label="Phone" value={form.phone} onChange={update("phone")} testId="contact-phone" />
              <Field label="Company / Group" value={form.company} onChange={update("company")} testId="contact-company" />
              <Field label="Approx quantity" value={form.quantity} onChange={update("quantity")} testId="contact-quantity" />
              <div>
                <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-2">Sector</label>
                <select data-testid="contact-sector" value={form.sector} onChange={update("sector")} className="w-full bg-white border border-[#e5e7eb] focus:border-[#7bc67e] outline-none rounded-xl px-3 py-2.5">
                  <option value="">— Choose —</option>
                  {SECTORS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-2">Tell us about your project *</label>
              <textarea data-testid="contact-message" rows={5} value={form.message} onChange={update("message")} className="w-full bg-white border border-[#e5e7eb] focus:border-[#7bc67e] outline-none rounded-xl px-3 py-2.5" placeholder="What garments, what print, deadline, budget, anything..." />
            </div>
            <button data-testid="contact-submit" type="submit" disabled={submitting} className="mt-6 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
              {submitting ? "Sending…" : <>Send Enquiry <Send size={16} /></>}
            </button>
            <p className="text-xs text-[#4b5563] mt-3">We typically reply within 1 working day.</p>
          </form>
        </div>
      </div>

      <BoldFooter />
    </div>
  );
}

function Field({ label, value, onChange, type = "text", testId }) {
  return (
    <div>
      <label className="block text-xs font-nunito font-bold text-[#1a1a1a] mb-2">{label}</label>
      <input data-testid={testId} type={type} value={value} onChange={onChange} className="w-full bg-white border border-[#e5e7eb] focus:border-[#7bc67e] outline-none rounded-xl px-3 py-2.5" />
    </div>
  );
}
