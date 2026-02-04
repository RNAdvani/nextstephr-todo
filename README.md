# Todo App

A modern, feature-rich todo application built with React, TypeScript, and Supabase. This was created as part of a technical interview task to demonstrate full-stack development skills.

## What I Built

This is a fully functional todo app with user authentication and some pretty cool features. It's got a brutalist design aesthetic (sharp edges, bold shadows, no rounded corners) that I think looks pretty clean.

### Core Features

- **User Authentication** - Sign up and login system using Supabase Auth
- **CRUD Operations** - Create, read, update, and delete todos (the basics done right)
- **Drag & Drop** - Reorder todos by dragging them around
- **Tags System** - Organize todos with multiple tags per item
- **Due Dates** - Set deadlines with visual indicators for overdue items
- **Search & Filter** - Find todos quickly with real-time search and filter by status/tags
- **Keyboard Shortcuts** - Power user features for faster navigation
- **Form Validation** - Proper validation using Zod and React Hook Form

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for blazing fast development
- Tailwind CSS for styling
- TanStack Query for server state management
- React Hook Form + Zod for forms and validation
- @dnd-kit for drag and drop
- React Router for routing

**Backend:**
- Supabase (PostgreSQL database)
- Row Level Security for data protection
- Supabase Auth for user management

## Getting Started

### Prerequisites

You'll need:
- Node.js 18+ installed
- A Supabase account and project

### Setup

1. Clone the repo and install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Set up your Supabase database by running this SQL in the SQL Editor:

```sql
-- Create todos table
create table todos (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  completed boolean default false,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade,
  due_at timestamptz,
  remind boolean default false,
  reminded boolean default false,
  tags text[] default '{}',
  "order" integer default 0
);

-- Enable RLS
alter table todos enable row level security;

-- RLS Policies
create policy "Users can view their own todos"
  on todos for select
  using (auth.uid() = user_id);

create policy "Users can create their own todos"
  on todos for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own todos"
  on todos for update
  using (auth.uid() = user_id);

create policy "Users can delete their own todos"
  on todos for delete
  using (auth.uid() = user_id);

-- Index for performance
create index idx_todos_order on todos("order");
```

4. Start the development server:
```bash
npm run dev
```

The app should now be running at `http://localhost:5173`

## How to Use

### Keyboard Shortcuts

I added some keyboard shortcuts to make things faster:
- `Ctrl+Enter` - Jump to the add todo input
- `Ctrl+/` - Focus the search bar
- `Escape` - Clear all filters and search
- `?` - Show the keyboard shortcuts modal

### Adding Todos

Just type in the input field and hit Add. You can also:
- Set a due date using the date picker
- Add tags (comma-separated like "work, urgent, backend")
- Check "Remind me" if you want reminders

### Organizing

- **Drag to reorder** - Grab the handle (≡) icon and drag todos around
- **Filter** - Use the All/Active/Completed tabs
- **Search** - Type in the search bar to find specific todos
- **Tags** - Click any tag to filter by that category

### Due Dates

The app shows visual indicators:
- Red border = Overdue
- Blue badge = Due today
- Regular badge = Future dates

## Design Choices

I went with a brutalist design approach because I think it's both functional and looks modern:
- Zero border radius (everything is sharp)
- Bold black borders on everything
- Box shadows for depth (the 4px offset kind)
- Red (#ff3333) as the primary color
- Bright yellow and blue as accents

The color scheme is easy to swap out since everything uses CSS variables.

## What Could Be Better

If I had more time, I'd add:
- Dark mode toggle (the CSS variables are already set up for it)
- Subtasks / nested todos
- Recurring tasks
- Browser notifications for reminders
- Collaboration features
- Export/import functionality

## Development Notes

- Used TanStack Query for smart caching and optimistic updates
- All forms use proper Zod validation (both client and server side)
- TypeScript throughout for type safety
- RLS policies ensure users only see their own data
- Responsive design works on mobile

## Building for Production

```bash
npm run build
```

The build outputs to the `dist` folder. You can preview it with:

```bash
npm run preview
```

## Project Structure

```
src/
├── features/
│   ├── auth/           # Login/signup components
│   └── todos/          # Todo CRUD operations
├── lib/                # Supabase client
├── util/               # Router and providers
└── main.tsx           # Entry point
```

