import {LucideIcon, Plus} from "lucide-react";

interface HeroSubSectionProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    actions?: React.ReactNode;
    actionBtn?:string;
    actionFn?:() => void;
}

export default function HeroSubSection({ title, subtitle, icon: Icon, actions, actionBtn, actionFn }: HeroSubSectionProps) {
    return (
        <section className="hero-sub-section trace-page-hero flex-shrink-0">
            <div className="trace-page-hero__inner" style={{marginTop: "80px"}}>
                <div className="trace-page-hero__content">
                    {Icon ? (
                        <div className="trace-page-hero__icon">
                            <Icon className="h-5 w-5" />
                        </div>
                    ) : null}
                    <div className="trace-page-hero__copy">
                        <h1 className="trace-page-hero__title">{title}</h1>
                        {subtitle ? <p className="trace-page-hero__subtitle">{subtitle}</p> : null}
                    </div>
                </div>
                {actions ? <div className="trace-page-hero__actions">{actions}</div> : null}
                {actionBtn && actionFn && (
                    <button
                        type="button"
                        onClick={actionFn}
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1E49E2] px-6 py-3 text-[14px] font-bold text-white"
                    >
                        <Plus size={18} />
                        {actionBtn}
                    </button>
                )}
            </div>
        </section>
    );
}
