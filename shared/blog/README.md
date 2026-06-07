# 📝 Blog / CMS Module (MDX)

This module provides a simple MDX-powered blog for content marketing.

## 📦 Dependencies

Add these to your `package.json`:

### Frontend (Next.js)
```json
{
  "dependencies": {
    "@next/mdx": "^14.1.0",
    "@mdx-js/loader": "^3.0.0",
    "@mdx-js/react": "^3.0.0",
    "gray-matter": "^4.0.3",
    "reading-time": "^1.5.0",
    "rehype-highlight": "^7.0.0",
    "rehype-slug": "^6.0.0",
    "remark-gfm": "^4.0.0"
  }
}
```

## 🔧 Environment Variables

```env
# Blog Configuration
NEXT_PUBLIC_BLOG_URL=/blog
BLOG_POSTS_PER_PAGE=10
```

## 📁 Files Added

```
your-project/
├── frontend/
│   ├── app/
│   │   └── blog/
│   │       ├── page.tsx           # Blog listing
│   │       ├── [slug]/page.tsx    # Individual post
│   │       └── rss.xml/route.ts   # RSS feed
│   ├── components/
│   │   └── blog/
│   │       ├── PostCard.tsx
│   │       ├── PostHeader.tsx
│   │       ├── TableOfContents.tsx
│   │       └── MDXComponents.tsx
│   └── lib/
│       └── blog.ts               # Blog utilities
├── content/
│   └── posts/
│       └── getting-started.mdx   # Example post
└── shared/blog/
    └── README.md
```

## 📝 MDX Post Format

```mdx
---
title: "Getting Started with Our Platform"
description: "Learn how to set up your account and start building amazing things."
date: "2024-01-15"
author:
  name: "John Doe"
  avatar: "/authors/john.jpg"
  twitter: "@johndoe"
image: "/blog/getting-started.jpg"
tags: ["tutorial", "getting-started"]
published: true
---

# Introduction

Welcome to our platform! In this guide, we'll walk you through...

## Prerequisites

Before you begin, make sure you have:

- Node.js 18+
- A GitHub account

## Step 1: Installation

```bash
npm install our-package
```

<Callout type="info">
  Pro tip: Use the CLI for faster setup!
</Callout>

## Conclusion

You're now ready to build amazing things!
```

## 🚀 Usage

### Blog Utility Functions

```typescript
// lib/blog.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

const postsDirectory = path.join(process.cwd(), 'content/posts');

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: {
    name: string;
    avatar?: string;
    twitter?: string;
  };
  image?: string;
  tags: string[];
  readingTime: string;
  content: string;
}

export async function getAllPosts(): Promise<Post[]> {
  const fileNames = fs.readdirSync(postsDirectory);
  
  const posts = fileNames
    .filter(fileName => fileName.endsWith('.mdx'))
    .map(fileName => {
      const slug = fileName.replace(/\.mdx$/, '');
      return getPostBySlug(slug);
    })
    .filter(post => post.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
}

export function getPostBySlug(slug: string): Post {
  const fullPath = path.join(postsDirectory, `${slug}.mdx`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  
  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    author: data.author,
    image: data.image,
    tags: data.tags || [],
    published: data.published ?? true,
    readingTime: readingTime(content).text,
    content
  };
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts.filter(post => post.tags.includes(tag));
}

export async function getAllTags(): Promise<string[]> {
  const posts = await getAllPosts();
  const tags = new Set<string>();
  posts.forEach(post => post.tags.forEach(tag => tags.add(tag)));
  return Array.from(tags);
}
```

### Blog Listing Page

```tsx
// app/blog/page.tsx
import { getAllPosts } from '@/lib/blog';
import { PostCard } from '@/components/blog/PostCard';

export const metadata = {
  title: 'Blog - Your App',
  description: 'Latest articles and tutorials'
};

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">Blog</h1>
      <p className="text-xl text-gray-600 mb-12">
        Latest articles, tutorials, and updates.
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map(post => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
```

### Post Card Component

```tsx
// components/blog/PostCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';

export function PostCard({ post }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <article className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        {post.image && (
          <div className="aspect-video relative overflow-hidden">
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
            />
          </div>
        )}
        <div className="p-6">
          <div className="flex gap-2 mb-3">
            {post.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
          <h2 className="text-xl font-bold mb-2 group-hover:text-primary-500 transition-colors">
            {post.title}
          </h2>
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {post.description}
          </p>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{format(new Date(post.date), 'MMM d, yyyy')}</span>
            <span>{post.readingTime}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
```

### Individual Post Page

```tsx
// app/blog/[slug]/page.tsx
import { getPostBySlug, getAllPosts } from '@/lib/blog';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { mdxComponents } from '@/components/blog/MDXComponents';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const post = getPostBySlug(params.slug);
  return {
    title: `${post.title} - Blog`,
    description: post.description,
    openGraph: { images: [post.image] }
  };
}

export default async function PostPage({ params }) {
  const post = getPostBySlug(params.slug);

  return (
    <article className="max-w-3xl mx-auto px-4 py-16">
      {/* Header */}
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <p className="text-xl text-gray-600 mb-6">{post.description}</p>
        <div className="flex items-center gap-4">
          <img 
            src={post.author.avatar} 
            className="w-12 h-12 rounded-full"
          />
          <div>
            <p className="font-medium">{post.author.name}</p>
            <p className="text-sm text-gray-500">
              {post.date} · {post.readingTime}
            </p>
          </div>
        </div>
      </header>

      {/* Featured Image */}
      {post.image && (
        <img 
          src={post.image} 
          alt={post.title}
          className="w-full rounded-xl mb-12"
        />
      )}

      {/* Content */}
      <div className="prose prose-lg max-w-none">
        <MDXRemote source={post.content} components={mdxComponents} />
      </div>
    </article>
  );
}
```

### RSS Feed

```typescript
// app/blog/rss.xml/route.ts
import { getAllPosts } from '@/lib/blog';

export async function GET() {
  const posts = await getAllPosts();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourapp.com';

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Your App Blog</title>
    <link>${siteUrl}/blog</link>
    <description>Latest articles and tutorials</description>
    <atom:link href="${siteUrl}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    ${posts.map(post => `
    <item>
      <title>${post.title}</title>
      <link>${siteUrl}/blog/${post.slug}</link>
      <description>${post.description}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <guid>${siteUrl}/blog/${post.slug}</guid>
    </item>
    `).join('')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: { 'Content-Type': 'application/xml' }
  });
}
```

## 🎨 Custom MDX Components

```tsx
// components/blog/MDXComponents.tsx
export const mdxComponents = {
  h1: (props) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
  h2: (props) => <h2 className="text-2xl font-bold mt-6 mb-3" {...props} />,
  h3: (props) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
  p: (props) => <p className="mb-4 leading-relaxed" {...props} />,
  a: (props) => <a className="text-primary-500 hover:underline" {...props} />,
  ul: (props) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
  ol: (props) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
  code: (props) => <code className="bg-gray-100 px-1 py-0.5 rounded" {...props} />,
  pre: (props) => <pre className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto mb-4" {...props} />,
  
  // Custom components
  Callout: ({ type, children }) => (
    <div className={`p-4 rounded-lg mb-4 ${
      type === 'info' ? 'bg-blue-50 border-l-4 border-blue-500' :
      type === 'warning' ? 'bg-yellow-50 border-l-4 border-yellow-500' :
      'bg-gray-50 border-l-4 border-gray-500'
    }`}>
      {children}
    </div>
  ),
  
  YouTube: ({ id }) => (
    <div className="aspect-video mb-4">
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        className="w-full h-full rounded-lg"
        allowFullScreen
      />
    </div>
  )
};
```

## ❓ Need Help?

- [MDX Documentation](https://mdxjs.com)
- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

