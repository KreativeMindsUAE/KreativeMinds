#!/usr/bin/env python3
"""Build blog HTML pages from CMS markdown files and update posts.json."""

import glob
import json
import os
import re
from datetime import datetime

import markdown


TEMPLATE_PATH = ".github/templates/blog-post-template.html"
POSTS_DIR = "blog/posts"
OUTPUT_DIR = "blog"
POSTS_JSON = "blog/posts.json"


def parse_frontmatter(content):
    """Parse YAML-like frontmatter from markdown content."""
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    meta = {}
    for line in parts[1].strip().split("\n"):
        line = line.strip()
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            meta[key] = value
    body = parts[2].strip()
    return meta, body


def format_date(date_str):
    """Format date string to readable format."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%B %d, %Y")
    except (ValueError, TypeError):
        return date_str or datetime.now().strftime("%B %d, %Y")


def build_post(md_path, template):
    """Build a single blog post HTML from markdown."""
    filename = os.path.splitext(os.path.basename(md_path))[0]
    output_path = os.path.join(OUTPUT_DIR, f"{filename}.html")

    with open(md_path, "r", encoding="utf-8") as f:
        raw = f.read()

    meta, body = parse_frontmatter(raw)

    title = meta.get("title", "")
    subtitle = meta.get("subtitle", "Blog Post")
    description = meta.get("description", "")
    image = meta.get("image", "")
    date = meta.get("date", "")
    author = meta.get("author", "Khalid Hussain Mir (Khalidgraphy)")
    readtime = meta.get("readtime", "5 Min Read")
    keywords = meta.get("keywords", "")

    display_date = format_date(date)

    # Convert markdown body to HTML
    body_html = markdown.markdown(
        body,
        extensions=["extra", "sane_lists"],
        output_format="html5",
    )

    # Build HTML from template
    html = template
    html = html.replace("{{TITLE}}", title)
    html = html.replace("{{SUBTITLE}}", subtitle)
    html = html.replace("{{DESCRIPTION}}", description)
    html = html.replace("{{IMAGE}}", image)
    html = html.replace("{{DATE}}", display_date)
    html = html.replace("{{READTIME}}", readtime)
    html = html.replace("{{AUTHOR}}", author)
    html = html.replace("{{KEYWORDS}}", keywords)
    html = html.replace("{{SLUG}}", filename)
    html = html.replace("{{BODY}}", body_html)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Built: {output_path}")
    return {
        "slug": filename,
        "title": title,
        "description": description,
        "image": image,
    }


def update_posts_json(posts_data):
    """Update the posts.json file with all blog post data."""
    # Also include existing HTML posts that were not from CMS
    existing = set(p["slug"] for p in posts_data)

    for html_file in sorted(glob.glob(os.path.join(OUTPUT_DIR, "*.html"))):
        filename = os.path.basename(html_file)
        if filename in ("index.html", "blog.html"):
            continue
        slug = os.path.splitext(filename)[0]
        if slug in existing:
            continue

        # Parse metadata from existing HTML files
        with open(html_file, "r", encoding="utf-8") as f:
            html_content = f.read()

        title_match = re.search(r"<title>(.+?)\s*\|", html_content)
        desc_match = re.search(
            r'<meta\s+name="description"\s+content="([^"]*)"', html_content
        )
        img_match = re.search(
            r'<meta\s+property="og:image"\s+content="([^"]*)"', html_content
        )

        title = title_match.group(1) if title_match else slug.replace("-", " ").title()
        description = desc_match.group(1) if desc_match else ""
        image = img_match.group(1) if img_match else ""

        posts_data.append(
            {
                "slug": slug,
                "title": title,
                "description": description,
                "image": image,
            }
        )

    with open(POSTS_JSON, "w", encoding="utf-8") as f:
        json.dump(posts_data, f, indent=2, ensure_ascii=False)

    print(f"Updated: {POSTS_JSON} with {len(posts_data)} posts")


def main():
    # Load template
    if not os.path.exists(TEMPLATE_PATH):
        print(f"Template not found: {TEMPLATE_PATH}")
        exit(1)

    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template = f.read()

    # Process all markdown posts
    md_files = sorted(glob.glob(os.path.join(POSTS_DIR, "*.md")))
    if not md_files:
        print("No markdown files found in blog/posts/")
        return

    posts_data = []
    for md_path in md_files:
        post_info = build_post(md_path, template)
        posts_data.append(post_info)

    # Update posts.json
    update_posts_json(posts_data)

    print(f"Done! Built {len(md_files)} posts.")


if __name__ == "__main__":
    main()
