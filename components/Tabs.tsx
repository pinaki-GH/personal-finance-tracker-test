"use client";

type Tab = {
  id: string;
  label: string;
};

type TabsProps = {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
};

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            marginRight: 8,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            cursor: "pointer",
            background: activeTab === tab.id ? "#2563eb" : "#f9f9f9",
            color: activeTab === tab.id ? "#fff" : "#000",
            fontWeight: activeTab === tab.id ? "bold" : "normal"
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
