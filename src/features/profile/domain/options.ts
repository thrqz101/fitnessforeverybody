import type { GoalType } from "@/shared/domain/types";

export const goals: Array<{ value: GoalType; label: string; detail: string }> = [
  { value: "muscle", label: "增肌", detail: "优先蛋白质和训练日热量盈余" },
  { value: "fat_loss", label: "减脂", detail: "制造热量缺口，同时保留肌肉" },
  { value: "weight_loss", label: "减肥/减重", detail: "更关注体重下降和日常热量控制，适合不训练或轻运动的人" },
  { value: "health", label: "健康管理", detail: "久坐和外卖人群的营养结构优化" }
];

export const trainingStyles = ["三分化", "五分化", "功能性训练", "徒手训练", "不训练"];

export const dietPatterns = ["三餐正常", "16+8 间歇性断食", "碳循环", "地中海 / 均衡饮食", "外卖 / 便利店为主", "不确定，先按普通模式算"];

export const goalLogic: Record<GoalType, string> = {
  muscle: "蛋白质和训练日碳水更高，总热量会略高于消耗，用来支持力量训练和肌肉恢复。",
  fat_loss: "保持较高蛋白质，制造温和热量缺口，优先保住肌肉和训练表现。",
  weight_loss: "更关注体重下降和日常热量控制，推荐会减少奶茶、火锅、烧烤这类高热量快乐选项。",
  health: "目标更均衡，纤维和蛋白质会被优先照顾，适合外卖和久坐人群。"
};

export const trainingDescriptions: Record<string, string> = {
  "三分化": "通常按推/拉/腿或上/下/全身拆分，适合每周 3-4 练；大肌群日会提高碳水和热量。",
  "五分化": "每天集中练一个部位，适合训练频率较高的人；系统会更看重当天训练部位和组数。",
  "功能性训练": "力量、心肺和动作能力混合，碳水和总热量会随训练时长上调。",
  "徒手训练": "以自重动作为主，需求中等，系统会根据组数和时长微调。",
  "不训练": "默认休息/轻活动，碳水和热量会降低，但蛋白质不会掉太多。"
};

export const dietDescriptions: Record<string, string> = {
  "三餐正常": "默认均衡模式，适合大多数新手，每天按正常三餐或加餐补足。",
  "16+8 间歇性断食": "总营养目标不大变，但推荐更集中到 2-3 餐，每餐蛋白质会更扎实。",
  "碳循环": "每天在日历里选普通日、高碳日、低碳日、高蛋白日或放纵日，系统按当天状态调整比例。",
  "地中海 / 均衡饮食": "更偏蔬菜、水果、优质脂肪和完整正餐，纤维目标会略高。",
  "外卖 / 便利店为主": "推荐会更偏连锁品牌、便利店和容易执行的组合，同时更提醒纤维。",
  "不确定，先按普通模式算": "不用先懂所有饮食结构，先按普通日记录，之后再慢慢调。"
};

export const bodyFatRanges = {
  male: [
    ["8-12%", "运动员", "腹肌清晰，线条明显"],
    ["13-17%", "精瘦", "腹肌轮廓明显，脂肪较少"],
    ["18-24%", "普通", "腹部开始有脂肪堆积"],
    ["25-31%", "偏高", "腰腹脂肪明显"],
    ["32%+", "较高", "整体脂肪较多"]
  ],
  female: [
    ["16-20%", "运动型", "线条明显，体脂较低"],
    ["21-24%", "精瘦", "腹部较平，脂肪适中"],
    ["25-31%", "普通", "健康常见范围"],
    ["32-38%", "偏高", "腰腹和臀腿脂肪更明显"],
    ["39%+", "较高", "整体脂肪较多"]
  ]
};

export const bodyFatPhotoRefs = [
  {
    title: "男性体脂对照图",
    range: "8% - 40%",
    src: "/images/body-fat-male.png",
    credit: "用户提供参考图"
  },
  {
    title: "女性体脂对照图",
    range: "18% - 45%",
    src: "/images/body-fat-female.png",
    credit: "用户提供参考图"
  }
];

export type BodyFatPhotoRef = (typeof bodyFatPhotoRefs)[number];
