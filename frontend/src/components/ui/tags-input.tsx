"use client";

import { Select, Tag } from "antd";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
};

export function TagsInput({ value, onChange, placeholder = "تگ + Enter" }: Props) {
  return (
    <Select
      mode="tags"
      style={{ width: "100%" }}
      value={value}
      onChange={(next) => onChange((next as string[]).slice(0, 20).map((t) => t.slice(0, 30)))}
      placeholder={placeholder}
      tokenSeparators={[","]}
      maxTagCount="responsive"
      tagRender={(props) => {
        const { label, closable, onClose } = props;
        return (
          <Tag color="cyan" closable={closable} onClose={onClose} style={{ marginInlineEnd: 4 }}>
            {label}
          </Tag>
        );
      }}
      open={false}
      suffixIcon={null}
    />
  );
}
