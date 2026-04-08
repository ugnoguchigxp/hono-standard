import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Accordion,
  AccordionContent,
  AccordionContentFooter,
  AccordionContentSection,
  AccordionItem,
  AccordionTrigger,
} from './Accordion';

const meta = {
  title: 'Components/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '階層化されたコンテンツを表示/非表示するためのアコーディオンコンポーネント。destructive、warning、successのバリアントをサポートします。',
      },
    },
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: 'single',
    collapsible: true,
    defaultValue: 'item-1',
  },
  render: (args) => {
    const items = [
      {
        value: 'item-1',
        variant: 'destructive' as const,
        label: '課題1.1',
        badge: '優先度TOP1',
        title: '経営者の多様な働き方や健康課題への理解',
        content: '経営者の多様な働き方や健康課題への理解を深めるための具体的な改善施策が必要です。',
        footer: '最終更新: 2026年2月19日 | ステータス: 対応中',
      },
      {
        value: 'item-2',
        variant: 'warning' as const,
        label: '課題2.1',
        badge: '注意',
        title: 'コミュニケーション改善プラン',
        content: '社内コミュニケーションの改善に向けた取り組みについて。',
        footer: '担当者: 人事部 | 期限: 2026年3月末',
      },
      {
        value: 'item-3',
        variant: 'success' as const,
        label: '課題3.1',
        badge: '完了',
        title: '福利厚生制度の見直し',
        content: '福利厚生制度の見直しが完了しました。',
        footer: '完了日: 2026年1月15日',
      },
    ];

    return (
      <Accordion {...args}>
        {items.map((item) => (
          <AccordionItem key={item.value} value={item.value} variant={item.variant}>
            <AccordionTrigger label={item.label} badge={item.badge} variant={item.variant}>
              {item.title}
            </AccordionTrigger>
            <AccordionContent>
              <AccordionContentSection>{item.content}</AccordionContentSection>
              <AccordionContentFooter>{item.footer}</AccordionContentFooter>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  },
};

export const AllVariants: Story = {
  args: {
    type: 'single',
    collapsible: true,
  },
  render: () => {
    const variants = [
      {
        variant: 'default' as const,
        label: undefined,
        title: 'デフォルトバリアント',
        description: 'デフォルトスタイルのアコーディオンアイテムです。',
        footer: 'default variant',
      },
      {
        variant: 'destructive' as const,
        label: '課題1.1',
        title: '要改善項目',
        description: '改善が必要な重要な課題を示します。',
        footer: 'destructive variant',
      },
      {
        variant: 'warning' as const,
        label: '課題1.1',
        title: '注意項目',
        description: '注意が必要な項目を示します。',
        footer: 'warning variant',
      },
      {
        variant: 'success' as const,
        label: '課題1.1',
        title: '良好項目',
        description: '良好な状態の項目を示します。',
        footer: 'success variant',
      },
    ];

    return (
      <>
        {variants.map((item) => (
          <Accordion key={item.variant} type="single" collapsible>
            <AccordionItem value={item.variant} variant={item.variant}>
              <AccordionTrigger label={item.label} variant={item.variant}>
                {item.title}
              </AccordionTrigger>
              <AccordionContent>
                <AccordionContentSection>{item.description}</AccordionContentSection>
                <AccordionContentFooter>{item.footer}</AccordionContentFooter>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
      </>
    );
  },
};

export const MultipleOpen: Story = {
  args: {
    type: 'multiple',
  },
  render: (args) => {
    const items = [
      {
        value: 'item-1',
        variant: 'destructive' as const,
        title: '複数開くことができます 1',
        content: 'type="multiple" を使用すると複数のアイテムを同時に開けます。',
        footer: 'アイテム 1',
      },
      {
        value: 'item-2',
        variant: 'warning' as const,
        title: '複数開くことができます 2',
        content: '2番目のアイテムです。',
        footer: 'アイテム 2',
      },
      {
        value: 'item-3',
        variant: 'success' as const,
        title: '複数開くことができます 3',
        content: '3番目のアイテムです。',
        footer: 'アイテム 3',
      },
    ];

    return (
      <Accordion {...args}>
        {items.map((item) => (
          <AccordionItem key={item.value} value={item.value} variant={item.variant}>
            <AccordionTrigger variant={item.variant}>{item.title}</AccordionTrigger>
            <AccordionContent>
              <AccordionContentSection>{item.content}</AccordionContentSection>
              <AccordionContentFooter>{item.footer}</AccordionContentFooter>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  },
};
