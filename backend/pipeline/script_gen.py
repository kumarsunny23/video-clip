import json
import logging
from openai import AsyncOpenAI
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def get_local_fallback(topic: str) -> dict:
    """
    Generates high-quality offline script structure for common topics
    when the API key is not present or has exceeded its limits.
    """
    normalized_topic = topic.lower().strip()
    
    # Custom binary search fallback
    if "binary" in normalized_topic and "search" in normalized_topic:
        return {
            "title": "How Binary Search Works",
            "scenes": [
                {
                    "scene_num": 1,
                    "narration": "Imagine you are searching for a specific name in a phone book. Instead of looking page by page, you open it right to the middle.",
                    "visuals": "Show a sorted list of numbers: 2, 5, 8, 12, 16, 23, 38, 56, 72, 91. Highlight the target number 23.",
                    "manim_code": """
class BinarySearchDemo(Scene):
    def construct(self):
        title = Title("Binary Search")
        self.play(Write(title))
        
        # Create array elements
        arr_vals = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
        boxes = VGroup(*[Square(side_length=0.8) for _ in arr_vals]).arrange(RIGHT, buff=0.1)
        labels = VGroup(*[Text(str(val), font_size=24).move_to(box) for val, box in zip(arr_vals, boxes)])
        
        array = VGroup(boxes, labels).center()
        self.play(FadeIn(array))
        self.wait(1)

        # Highlight target
        target_text = Text("Target: 23", font_size=28, color=YELLOW).next_to(array, UP)
        self.play(Write(target_text))
        self.wait(1)

        # Low, High, Mid markers
        low_ptr = Arrow(DOWN, UP, color=BLUE).next_to(boxes[0], DOWN)
        high_ptr = Arrow(DOWN, UP, color=BLUE).next_to(boxes[-1], DOWN)
        self.play(GrowArrow(low_ptr), GrowArrow(high_ptr))
        self.wait(1)

        # Iteration 1: Mid = (0 + 9) // 2 = 4 (value 16)
        mid_ptr = Arrow(DOWN, UP, color=RED).next_to(boxes[4], DOWN)
        self.play(GrowArrow(mid_ptr))
        self.wait(1)
        self.play(boxes[4].animate.set_color(RED))
        self.wait(1)

        # Since 16 < 23, low = 5
        self.play(
            FadeOut(low_ptr),
            FadeOut(mid_ptr),
            boxes[4].animate.set_color(WHITE)
        )
        low_ptr = Arrow(DOWN, UP, color=BLUE).next_to(boxes[5], DOWN)
        self.play(GrowArrow(low_ptr))
        self.wait(1)

        # Iteration 2: Mid = (5 + 9) // 2 = 7 (value 56)
        mid_ptr = Arrow(DOWN, UP, color=RED).next_to(boxes[7], DOWN)
        self.play(GrowArrow(mid_ptr))
        self.wait(1)
        self.play(boxes[7].animate.set_color(RED))
        self.wait(1)

        # Since 56 > 23, high = 6
        self.play(
            FadeOut(high_ptr),
            FadeOut(mid_ptr),
            boxes[7].animate.set_color(WHITE)
        )
        high_ptr = Arrow(DOWN, UP, color=BLUE).next_to(boxes[6], DOWN)
        self.play(GrowArrow(high_ptr))
        self.wait(1)

        # Iteration 3: Mid = (5 + 6) // 2 = 5 (value 23)
        mid_ptr = Arrow(DOWN, UP, color=RED).next_to(boxes[5], DOWN)
        self.play(GrowArrow(mid_ptr))
        self.wait(1)
        self.play(boxes[5].animate.set_color(GREEN))
        
        found_text = Text("Found Target 23!", font_size=36, color=GREEN).next_to(array, DOWN, buff=1.5)
        self.play(Write(found_text))
        self.wait(2)
"""
                }
            ]
        }

    # Custom binary tree fallback
    if "binary" in normalized_topic and "tree" in normalized_topic:
        return {
            "title": "Introduction to Binary Trees",
            "scenes": [
                {
                    "scene_num": 1,
                    "narration": "A binary tree is a hierarchical data structure where each node has at most two children: a left child and a right child. Let's see how a binary tree is structured starting with the root node.",
                    "visuals": "Show a hierarchical node structure. Start with a root node 'A', then link down to left child 'B' and right child 'C'.",
                    "manim_code": """
class BinaryTreeDemo(Scene):
    def construct(self):
        title = Title("Binary Tree Structure")
        self.play(Write(title))
        
        # Create Nodes
        root = Circle(radius=0.4, color=BLUE).shift(UP * 1.5)
        root_txt = Text("Root", font_size=20).move_to(root)
        
        left_child = Circle(radius=0.4, color=GREEN).shift(LEFT * 1.5 + DOWN * 0.5)
        left_txt = Text("Left", font_size=20).move_to(left_child)
        
        right_child = Circle(radius=0.4, color=GREEN).shift(RIGHT * 1.5 + DOWN * 0.5)
        right_txt = Text("Right", font_size=20).move_to(right_child)
        
        self.play(FadeIn(root), Write(root_txt))
        self.wait(1)
        
        # Show child nodes
        self.play(
            FadeIn(left_child), Write(left_txt),
            FadeIn(right_child), Write(right_txt)
        )
        self.wait(1)
        
        # Create pointer links
        line1 = Line(root.get_bottom(), left_child.get_top(), buff=0.1)
        line2 = Line(root.get_bottom(), right_child.get_top(), buff=0.1)
        
        self.play(Create(line1), Create(line2))
        self.wait(2)
"""
                }
            ]
        }

    # General topic fallback
    return {
        "title": f"Understanding {topic}",
        "scenes": [
            {
                "scene_num": 1,
                "narration": f"Let's explore {topic}. Understanding this concept is easier than it looks. We start with the core elements.",
                "visuals": f"Show a beautiful introduction text explaining {topic}.",
                "manim_code": f"""
class EducationalVideo(Scene):
    def construct(self):
        title = Title("{topic.title()}")
        self.play(Write(title))
        self.wait(1)
        
        intro_text = Paragraph(
            "Let's explore the key ideas",
            "behind this fascinating topic.",
            alignment="center",
            font_size=32
        ).center()
        
        self.play(FadeIn(intro_text))
        self.wait(2)
        
        # Make a beautiful circle and square illustration
        circle = Circle(radius=1.5, color=BLUE).shift(LEFT * 2)
        square = Square(side_length=2.5, color=GREEN).shift(RIGHT * 2)
        
        self.play(Transform(intro_text, VGroup(circle, square)))
        self.wait(2)
        
        self.play(Rotate(circle, angle=PI), Rotate(square, angle=PI))
        self.wait(2)
"""
            }
        ]
    }

async def generate_script(topic: str) -> dict:
    """
    Generates a pedagogical script with narration and visual descriptions.
    If the API key is not set or throws an exception (e.g. rate limit, quota exceeded),
    falls back gracefully to high-quality simulated scripts to prevent pipeline crash.
    """
    if not settings.openai_api_key or "your-openai-key" in settings.openai_api_key:
        logger.info("OpenAI API key missing or default. Falling back to local offline generator...")
        return get_local_fallback(topic)

    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        system_prompt = (
            "You are an expert pedagogical scriptwriter and Manim animation developer.\n"
            "Your task is to convert an educational topic into a fully-functional Manim script.\n"
            "Generate a JSON response that conforms EXACTLY to this schema:\n"
            "{\n"
            "  \"title\": \"Title of the lesson\",\n"
            "  \"scenes\": [\n"
            "    {\n"
            "      \"scene_num\": 1,\n"
            "      \"narration\": \"Narration spoken during this scene\",\n"
            "      \"visuals\": \"Visual description of what is happening\",\n"
            "      \"manim_code\": \"A complete Manim Python class representing this scene. It should be a standalone Scene subclass. Make sure it uses modern Manim Community syntax, handles objects beautifully, and waits for a total duration matching the narration length.\"\n"
            "    }\n"
            "  ]\n"
            "}\n"
            "Guidelines:\n"
            "1. Manim code MUST be self-contained and run cleanly. Use valid Python syntax.\n"
            "2. Do not write markdown markers or extra text, just return the JSON object."
        )
        
        user_prompt = f"Create a script and Manim visual code for this topic: {topic}"
        
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        return json.loads(content)
        
    except Exception as e:
        logger.warning(f"OpenAI API call failed: {e}. Gracefully falling back to local offline generator...")
        return get_local_fallback(topic)
