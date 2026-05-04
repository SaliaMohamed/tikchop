'use client'
import {cn} from '@/lib/utils'

interface MeteorsProps {
   number?: number
}
export function Meteors({ number = 20 }: MeteorsProps) {
   const meteorStyles = Array.from({ length: number }, (_, index) => ({
      top: -5,
      left: `${(index * 137) % 1200}px`,
      animationDelay: `${(index % 5) * 0.2 + 0.2}s`,
      animationDuration: `${(index % 8) + 2}s`,
   }))

   return (
      <>
         {[...meteorStyles].map((style, idx) => (
            // Meteor Head
            <span
               key={idx}
               className={cn(
                  'pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-0.5 rotate-[215deg] animate-meteor rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_#ffffff10]',
               )}
               style={style}
            >
               {/* Meteor Tail */}
               <div className="pointer-events-none absolute top-1/2 -z-10 h-px w-[50px] -translate-y-1/2 bg-gradient-to-r from-slate-500 to-transparent" />
            </span>
         ))}
      </>
   )
}


