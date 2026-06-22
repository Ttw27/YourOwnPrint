import React, { useState } from "react";
import { IndustrialNavbar, IndustrialFooter } from "../components/IndustrialLayout";
import { submitContact } from "../lib/api";
import { toast } from "sonner";
import { SECTORS } from "../lib/data";
import { Phone, Mail, MessageSquare, Send } from "lucide-react";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "", quantity: "", sector: "" });
  const [submitting, setSubmitting] = useState(false);

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
      toast.success("Thanks! We'll be in touch within 1 working day.");
      setForm({ name: "", email: "", phone: "", company: "", message: "", quantity: "", sector: "" });
    } catch (err) {
      toast.error("Something went wrong. Please try again or email us.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0d0d0d] min-h-screen text-white font-ibm">
      <IndustrialNavbar />

      <div className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-5 gap-10">
        <div className="lg:col-span-2">
          <div className="text-[#ff6b35] font-oswald uppercase text-sm tracking-[0.3em]">Talk to us</div>
          <h1 className="font-oswald uppercase font-bold text-4xl lg:text-5xl mt-3 leading-tight">Get a Quote.<br />No Pressure.</h1>
          <p className="text-neutral-300 mt-5 max-w-md">Tell us a bit about what you need — we'll come back with a tailored quote, fabric advice, and free logo design ideas.</p>
          <div className="mt-8 space-y-4">
            {[
              { icon: Phone, label: "Chat to a real human", val: "Mon–Fri · UK based" },
              { icon: Mail, label: "Email", val: "hello@yourownprint.co.uk" },
              { icon: MessageSquare, label: "Account management", val: "Large or complex orders welcome" },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="flex items-start gap-4">
                <span className="w-10 h-10 grid place-items-center border border-[#333] text-[#ff6b35]"><Icon size={18} /></span>
                <div>
                  <div className="font-oswald uppercase tracking-wider text-sm text-neutral-300">{label}</div>
                  <div className="text-white">{val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={onSubmit} className="lg:col-span-3 bg-[#111] border border-[#222] p-6 lg:p-8" data-testid="contact-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name *" value={form.name} onChange={update("name")} testId="contact-name" />
            <Field label="Email *" type="email" value={form.email} onChange={update("email")} testId="contact-email" />
            <Field label="Phone" value={form.phone} onChange={update("phone")} testId="contact-phone" />
            <Field label="Company / Group" value={form.company} onChange={update("company")} testId="contact-company" />
            <Field label="Approx quantity" value={form.quantity} onChange={update("quantity")} testId="contact-quantity" />
            <div>
              <label className="block text-xs font-oswald uppercase tracking-widest text-neutral-400 mb-2">Sector</label>
              <select data-testid="contact-sector" value={form.sector} onChange={update("sector")} className="w-full bg-[#0d0d0d] border border-[#333] focus:border-[#ff6b35] outline-none px-3 py-2.5 text-white">
                <option value="">— Choose —</option>
                {SECTORS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-oswald uppercase tracking-widest text-neutral-400 mb-2">Tell us about your project *</label>
            <textarea data-testid="contact-message" rows={5} value={form.message} onChange={update("message")} className="w-full bg-[#0d0d0d] border border-[#333] focus:border-[#ff6b35] outline-none px-3 py-2.5 text-white" placeholder="What garments, what print, deadline, budget, anything..." />
          </div>
          <button data-testid="contact-submit" type="submit" disabled={submitting} className="mt-6 inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#e55a2b] disabled:opacity-60 text-white font-oswald uppercase tracking-wider px-8 py-4 transition-transform hover:-translate-y-1">
            {submitting ? "Sending…" : <>Send Enquiry <Send size={16} /></>}
          </button>
          <p className="text-xs text-neutral-500 mt-3">We typically reply within 1 working day.</p>
        </form>
      </div>

      <IndustrialFooter />
    </div>
  );
}

function Field({ label, value, onChange, type = "text", testId }) {
  return (
    <div>
      <label className="block text-xs font-oswald uppercase tracking-widest text-neutral-400 mb-2">{label}</label>
      <input data-testid={testId} type={type} value={value} onChange={onChange} className="w-full bg-[#0d0d0d] border border-[#333] focus:border-[#ff6b35] outline-none px-3 py-2.5 text-white" />
    </div>
  );
}
