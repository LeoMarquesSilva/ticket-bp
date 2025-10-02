import React from "react";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div className={`container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl ${className}`}>
      <div className="py-6">
        {children}
      </div>
    </div>
  );
}