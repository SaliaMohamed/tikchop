"use client";

import { MessageCircle } from "lucide-react";
import { getTemplateToneClass } from "../../../lib/crm-utils";
import { buildWhatsappHref } from "../../../lib/customer-response-playbook";

export function CustomerResponseRail({ templates, phoneNumber }) {
  if (!templates.length) return null;

  return (
    <section>
      <div className="flex items-center gap-2 border-b border-[#0F2B20]/8 pb-2">
        <MessageCircle size={14} className="text-[#059669]" />
        <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#059669]">Messages</p>
      </div>
      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {templates.map((template) => {
          const href = buildWhatsappHref(phoneNumber, template.text);
          return (
            <a
              key={template.id}
              href={href || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`min-w-[140px] rounded-[20px] p-3 text-left no-underline ring-1 ${href ? getTemplateToneClass(template.tone) : "pointer-events-none bg-[#0F2B20]/5 text-[#0F2B20]/30 ring-transparent"}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/50 text-current">
                  <MessageCircle size={14} />
                </span>
                <span className="text-[0.65rem] font-black uppercase tracking-[0.12em] opacity-80">{template.shortTitle}</span>
              </div>
              <p className="mt-2 font-display text-sm font-black leading-4">{template.title}</p>
              <p className="mt-1 text-[0.68rem] font-bold leading-3 opacity-75">{template.scenario}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}