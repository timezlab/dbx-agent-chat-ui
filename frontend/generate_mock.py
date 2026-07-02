import json
import base64
import io
import time
import random
from PIL import Image, ImageDraw, ImageFont

# Pillow Setup
SCALE = 2
W, H = 660*SCALE, 360*SCALE
PAD_L, PAD_R, PAD_T, PAD_B = 62*SCALE, 20*SCALE, 46*SCALE, 64*SCALE
PW, PH = W-PAD_L-PAD_R, H-PAD_T-PAD_B
COLORS = [(79,70,229),(225,29,72),(8,145,178)]
GRID=(226,232,240); AXIS=(100,116,139); LAB=(51,65,85); TIT=(30,41,59)
BASE="/usr/share/fonts/truetype/dejavu/"

def font(sz,bold=False):
    return ImageFont.truetype(BASE+("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"), sz*SCALE)

def new_canvas(title):
    img = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((W/2, 14*SCALE), title, font=font(15, True), fill=TIT, anchor="mt")
    return img, draw

def y_axis(draw, vmin, vmax, ticks=5, fmt="{:,.0f}"):
    step = (vmax - vmin) / ticks
    for i in range(ticks + 1):
        v = vmin + i * step
        y = H - PAD_B - (i / ticks) * PH
        draw.line([(PAD_L, y), (W - PAD_R, y)], fill=GRID, width=1*SCALE)
        draw.text((PAD_L - 8*SCALE, y), fmt.format(v), font=font(11), fill=AXIS, anchor="rm")

def legend(draw, items):
    x, y = PAD_L, H - PAD_B + 30*SCALE
    for label, color in items:
        draw.rectangle([(x, y), (x + 12*SCALE, y + 12*SCALE)], fill=color)
        draw.text((x + 18*SCALE, y + 6*SCALE), label, font=font(11), fill=LAB, anchor="lm")
        tw = draw.textlength(label, font=font(11))
        x += 18*SCALE + tw + 20*SCALE

def data_uri(img):
    buf=io.BytesIO()
    img.save(buf,format="PNG",optimize=True)
    return "data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode()

def chart_mrr_trend():
    img, draw = new_canvas("Diễn Biến MRR Hàng Tháng 2026 — Actual vs Budget vs SPLY (ngàn $)")
    y_axis(draw, 100, 300, 4)
    months = ["T1/26", "T2/26", "T3/26", "T4/26", "T5/26"]
    actual = [180, 190, 195, 205, 215]
    budget = [185, 195, 210, 225, 240]
    sply = [150, 160, 165, 170, 180]
    series = [(actual, COLORS[0]), (budget, COLORS[1]), (sply, COLORS[2])]
    legend(draw, [("Actual", COLORS[0]), ("Budget", COLORS[1]), ("SPLY", COLORS[2])])
    for s_idx, (data, color) in enumerate(series):
        pts = []
        for i, val in enumerate(data):
            x = PAD_L + (i + 0.5) * (PW / len(months))
            y = H - PAD_B - ((val - 100) / 200) * PH
            pts.append((x, y))
            if s_idx == 0:
                draw.text((x, H - PAD_B + 10*SCALE), months[i], font=font(11), fill=LAB, anchor="mt")
        draw.line(pts, fill=color, width=3*SCALE, joint="curve")
        for x, y in pts:
            draw.ellipse([(x - 4*SCALE, y - 4*SCALE), (x + 4*SCALE, y + 4*SCALE)], fill=color)
    return data_uri(img)

def chart_segment_rev():
    img, draw = new_canvas("Doanh Thu YTD T1–T5/2026 theo Phân Khúc (ngàn $)")
    y_axis(draw, 0, 5000, 5)
    segments = ["Enterprise", "Mid-Market", "SMB", "Prosumer", "Startup"]
    vals = [4200, 2800, 1500, 800, 450]
    color = COLORS[0]
    for i, (seg, val) in enumerate(zip(segments, vals)):
        slot_w = PW / len(segments)
        cx = PAD_L + i * slot_w + slot_w / 2
        bw = slot_w * 0.6
        x1, x2 = cx - bw/2, cx + bw/2
        y1 = H - PAD_B - (val / 5000) * PH
        y2 = H - PAD_B
        draw.rectangle([(x1, y1), (x2, y2)], fill=color)
        draw.text((cx, y1 - 5*SCALE), f"{val:,}", font=font(10), fill=LAB, anchor="mb")
        draw.text((cx, H - PAD_B + 10*SCALE), seg, font=font(11), fill=LAB, anchor="mt")
    return data_uri(img)

def chart_margin():
    img, draw = new_canvas("Gross Margin Hàng Tháng 2026 vs 2025 (%)")
    y_axis(draw, 60, 90, 6, fmt="{:.1f}")
    months = ["T1", "T2", "T3", "T4", "T5"]
    m2026 = [78.5, 78.2, 79.0, 75.4, 76.8]
    m2025 = [76.0, 76.5, 76.8, 77.0, 77.2]
    series = [(m2026, COLORS[0]), (m2025, COLORS[1])]
    legend(draw, [("2026", COLORS[0]), ("2025", COLORS[1])])
    for s_idx, (data, color) in enumerate(series):
        pts = []
        for i, val in enumerate(data):
            x = PAD_L + (i + 0.5) * (PW / len(months))
            y = H - PAD_B - ((val - 60) / 30) * PH
            pts.append((x, y))
            if s_idx == 0:
                draw.text((x, H - PAD_B + 10*SCALE), months[i], font=font(11), fill=LAB, anchor="mt")
        draw.line(pts, fill=color, width=3*SCALE, joint="curve")
        for x, y in pts:
            draw.ellipse([(x - 4*SCALE, y - 4*SCALE), (x + 4*SCALE, y + 4*SCALE)], fill=color)
    return data_uri(img)


def chunk_text(text, chunk_size=4):
    for i in range(0, len(text), chunk_size):
        yield text[i:i+chunk_size]

events = []

def add_reasoning(text):
    for chunk in chunk_text(text):
        events.append(json.dumps({
            "type": "response.reasoning_text.delta",
            "custom_outputs": None,
            "item_id": "rs_a1b2c3d4",
            "delta": chunk
        }))

def add_fc(call_id, name, args, output=None):
    events.append(json.dumps({
        "type": "response.output_item.done",
        "custom_outputs": None,
        "item": {
            "type": "function_call",
            "id": f"fc_{call_id}",
            "call_id": f"toolu_{call_id}",
            "name": name,
            "arguments": args,
            "status": "completed" if output else "pending"
        }
    }))
    if output:
        events.append(json.dumps({
            "type": "response.output_item.done",
            "custom_outputs": None,
            "item": {
                "type": "function_call_output",
                "call_id": f"toolu_{call_id}",
                "output": output
            }
        }))

import re

def add_output(text):
    # Find all ![...](data:image...) and split the text
    pattern = re.compile(r'(!\[.*?\]\(data:image/png;base64,[^\)]+\))')
    parts = pattern.split(text)
    
    for part in parts:
        if part.startswith('!['):
            # Send image in one big chunk
            events.append(json.dumps({
                "type": "response.output_text.delta",
                "custom_outputs": None,
                "item_id": "msg_d046a17b",
                "delta": part
            }))
        else:
            # Chunk normal text
            for chunk in chunk_text(part):
                events.append(json.dumps({
                    "type": "response.output_text.delta",
                    "custom_outputs": None,
                    "item_id": "msg_d046a17b",
                    "delta": chunk
                }))

# Build the story
add_reasoning("Người dùng muốn báo cáo hiệu quả GlobalTech YTD T1–T5/2026. Mình cần: (1) khung PnL & định nghĩa phân khúc từ wiki, (2) số liệu Actual/Budget/SPLY từ data_agent, (3) chart MRR theo tháng & phân khúc, (4) hành động khuyến nghị, (5) build HTML report. Bắt đầu bằng lập kế hoạch rồi grep wiki.")

# Define the full plan
todos = [
    {"content": "Grep wiki for GlobalTech PnL framework", "status": "in_progress"},
    {"content": "Query data_agent for GlobalTech overview performance", "status": "pending"},
    {"content": "Create charts for MRR trend and segment breakdown", "status": "pending"},
    {"content": "Generate actions based on margin and revenue gap", "status": "pending"},
    {"content": "Build final HTML report", "status": "pending"}
]
add_fc("01UUrhtQ", "write_todos", json.dumps({"todos": todos}), "✅")

# Task 1: Wiki
add_reasoning("Đang tìm tài liệu cấu trúc PnL của GlobalTech...")
add_fc("01BTpAcr", "read_file", '{"file_path":"/skills/financial-analysis/SKILL.md","offset":0,"limit":100}', "✅")
add_fc("012Q9HAY", "grep", '{"pattern":"Revenue|MRR|segment","path":"/wiki/globaltech/","glob":null,"output_mode":"content"}', "/wiki/globaltech/sales.md: Revenue framework")

todos[0]["status"] = "completed"
todos[1]["status"] = "in_progress"
add_fc("01GkGVnE", "write_todos", json.dumps({"todos": todos}), "✅")

# Task 2: Data Agent
add_reasoning("Tiếp theo, gọi data_agent để lấy dữ liệu YTD của GlobalTech.")
add_fc("015vAcxa", "task", '{"description":"Retrieve GlobalTech overall performance overview for January to May 2026 (YTD).","subagent_type":"data_agent"}', "| MRR | Revenue | Margin |\\n| 8.724 | 10.171 | 76.8% |")

todos[1]["status"] = "completed"
todos[2]["status"] = "in_progress"
add_fc("02AbCdef", "write_todos", json.dumps({"todos": todos}), "✅")

# Task 3: Charts
add_reasoning("Có dữ liệu rồi, giờ tạo 3 biểu đồ: MRR Trend, Segment Revenue, và Gross Margin.")
c1 = chart_mrr_trend()
add_fc("012gd2RB", "create_chart", '{"type":"line","title":"MRR Trend"}', f"Chart stored. Place this token in your response: [chart:mrr]")

c2 = chart_segment_rev()
add_fc("017TWpdj", "create_chart", '{"type":"horizontal_bar","title":"Segment Revenue"}', f"Chart stored. Place this token in your response: [chart:seg]")

c3 = chart_margin()
add_fc("01JM9Y3w", "create_chart", '{"type":"line","title":"Margin Trend"}', f"Chart stored. Place this token in your response: [chart:mar]")

todos[2]["status"] = "completed"
todos[3]["status"] = "in_progress"
add_fc("03DefGhi", "write_todos", json.dumps({"todos": todos}), "✅")

# Task 4: Actions
add_reasoning("Phân tích gap và đề xuất hành động. MRR đạt 78.4% KH, cần upsell Enterprise. Margin giảm T4 do chi phí server, cần optimize.")
add_fc("04GhiJkl", "read_file", '{"file_path":"/wiki/globaltech/action_guidelines.md","offset":0,"limit":100}', "Guideline: Priority 1 is MRR gap closure. Priority 2 is Margin protection.")

todos[3]["status"] = "completed"
todos[4]["status"] = "in_progress"
add_fc("05JklMno", "write_todos", json.dumps({"todos": todos}), "✅")

# Task 5: Build Report
add_reasoning("Đã đủ nguyên liệu. Lưu report ra file HTML và gửi markdown cho người dùng.")
add_fc("06MnoPqr", "write_to_file", '{"file_path":"/reports/2026/globaltech_ytd.html","content":"<html>...</html>"}', "✅ Saved to /reports/2026/globaltech_ytd.html")

todos[4]["status"] = "completed"
add_fc("07PqrStu", "write_todos", json.dumps({"todos": todos}), "✅")

output_text = f"""## GlobalTech — Tổng Quan Hiệu Quả Kinh Doanh YTD T1–T5/2026

---

### 1. Chỉ Số Tài Chính Chủ Chốt (YTD T5/2026)

| Chỉ Số | Actual YTD (ngàn $) | Budget YTD (ngàn $) | SPLY YTD (ngàn $) | vs KH | vs SPLY |
|---|---|---|---|---|---|
| **Revenue** | **10.171** | 10.987 | 8.868 | **-7,4%** | **+14,7%** |
| **MRR** | **8.724** | 8.978 | 7.226 | **-2,8%** | **+20,7%** |
| **Services** | **1.320** | 1.596 | 1.454 | **-17,3%** | **-9,2%** |

**Nhận định tổng quan:** GlobalTech tăng trưởng mạnh so với cùng kỳ (+14,7% Revenue YoY) nhưng đang dưới kế hoạch. Áp lực chủ yếu từ Services.

---

### 2. Diễn Biến Hàng Tháng — MRR

![MRR Trend]({c1})

> Gap vs Budget mở rộng đáng kể từ T4 và T5. Cần tối ưu Sales Funnel.

---

### 3. Phân Khúc Khách Hàng (YTD T5/2026)

![Segment Revenue]({c2})

> **Enterprise** chiếm 41,9% tổng Revenue. Dư địa cross-sell lớn cho Mid-Market.

---

### 4. Gross Margin Hàng Tháng

![Gross Margin]({c3})

> Gross Margin T4 giảm đột ngột xuống 75,4% (thấp nhất 5 tháng), trước khi phục hồi về 76,8% tại T5. Cần theo dõi nguyên nhân (mix sản phẩm, chi phí server).

---

### 5. Khuyến Nghị Hành Động

**🔴 [Ưu tiên cao] Thúc đẩy MRR — Thu hẹp gap ngân sách**
- **Tại sao:** MRR đạt 78,4% KH — gap lớn nhất, trực tiếp ảnh hưởng định giá.
- **Hành động:** Chiến dịch upsell Enterprise; tối ưu onboarding Mid-Market.

**🟡 [Trung bình] Bảo vệ Gross Margin — Ngăn sụt giảm T4 tái diễn**
- **Tại sao:** Margin T4 giảm, áp lực chi phí hạ tầng tăng.
- **Hành động:** Tối ưu cloud server; theo dõi chi phí API bên thứ 3.

---

**Nguồn tham khảo**
[[1] sales-q2-2026.md](https://example.com/sales)

[Nhấp vào đây để xem báo cáo chi tiết](https://example.com/report)
"""

add_output(output_text)

# Add the final item done
events.append(json.dumps({
    "type": "response.output_item.done",
    "custom_outputs": None,
    "item": {
        "id": "msg_d046a17b",
        "content": [{"text": output_text, "type": "output_text", "annotations": []}],
        "role": "assistant",
        "type": "message"
    }
}))

with open("/home/liamlee/timezlab/dbx-agent-chat-ui/frontend/sse-recordings/default.txt", "w") as f:
    for ev in events:
        f.write(f"data: {ev}\n\n")

print("Generated mock recording at frontend/sse-recordings/default.txt")
