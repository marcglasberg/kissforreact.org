#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to generate a consolidated markdown file containing all Kiss State Management documentation
 * This combines the homepage overview with all documentation files in the correct order
 */

const PROJECT_ROOT = path.join(__dirname, '..');
const REACT_DOCS_DIR = path.join(PROJECT_ROOT, 'react');
const HOMEPAGE_OVERVIEW = path.join(PROJECT_ROOT, 'src/components/HomepageFeatures/overview-react.mdx');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'kiss-state-management-docs.md');

// Define the order of sections based on the logical flow
const SECTION_ORDER = [
  { path: 'intro.md', title: 'Introduction' },
  { path: 'tutorial', title: 'Tutorial', isDirectory: true },
  { path: 'basics', title: 'Basics', isDirectory: true },
  { path: 'advanced-actions', title: 'Advanced Actions', isDirectory: true },
  { path: 'testing', title: 'Testing', isDirectory: true },
  { path: 'miscellaneous', title: 'Miscellaneous', isDirectory: true },
];

// Define the order within tutorial section
const TUTORIAL_ORDER = [
  'creating-the-state.md',
  'setting-up-the-store.mdx',
  'plain-javascript-obj.md', 
  'the-basic-ui.md',
  'sync-actions.md',
  'async-actions.md',
  'handling-action-errors.md',
  'persisting-the-state.md',
  'testing.md',
  'other-improvements.md',
  'full-code.md',
  'conclusion.md'
];

function readMarkdownFile(filePath, expectedTitle = null) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File not found: ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  
  // Remove frontmatter if present
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
  let cleanContent = content.replace(frontmatterRegex, '');
  
  // Clean up the content - pass the filename for special handling
  const fileName = path.basename(filePath);
  cleanContent = cleanupContent(cleanContent, expectedTitle, fileName);
  
  return cleanContent.trim();
}

function cleanupContent(content, expectedTitle = null, fileName = null) {
  // Remove Docusaurus-specific imports
  const importPatterns = [
    /import\s+\w+\s+from\s+['"]@theme\/\w+['"];?\s*\n?/g,
    /import\s+\{\s*[\w\s,]+\s*\}\s+from\s+['"]@theme\/[\w\/]+['"];?\s*\n?/g,
    /import\s+\w+\s+from\s+['"]@docusaurus\/[\w\/\-]+['"];?\s*\n?/g,
    /import\s+\{\s*[\w\s,]+\s*\}\s+from\s+['"]@docusaurus\/[\w\/\-]+['"];?\s*\n?/g,
  ];

  let cleanedContent = content;
  
  // Remove all import statements
  importPatterns.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, '');
  });

  // Special handling for intro.md - remove the comparison section
  if (fileName && fileName.includes('intro.md')) {
    // Remove everything from "## How does it compare?" to the end of that section
    // This includes the section header, content, comparison links, and hr tag
    cleanedContent = cleanedContent.replace(
      /## How does it compare\?[\s\S]*?<hr><\/hr>\s*/g,
      ''
    );
  }

  // Remove redundant H1 title if it matches our expected title
  if (expectedTitle) {
    // Normalize titles for comparison - remove punctuation, normalize case and spacing
    const normalizeTitle = (title) => {
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')    // Normalize spacing
        // Handle common abbreviations
        .replace(/\bobj\b/g, 'object')
        .replace(/\bobjs\b/g, 'objects')  
        .replace(/\bapi\b/g, 'application programming interface')
        .replace(/\bui\b/g, 'user interface')
        .trim();
    };
    
    const normalizedExpected = normalizeTitle(expectedTitle);
    
    // Look for H1 titles and remove if they match
    const h1Regex = /^#\s+(.+?)\s*\n/;
    const match = cleanedContent.match(h1Regex);
    
    if (match) {
      const normalizedFound = normalizeTitle(match[1]);
      // Check for exact match or if one is contained in the other (handles plural/singular)
      if (normalizedFound === normalizedExpected || 
          normalizedFound.includes(normalizedExpected) || 
          normalizedExpected.includes(normalizedFound)) {
        cleanedContent = cleanedContent.replace(h1Regex, '');
      }
    }
  }

  // Convert iframes to CodeSandbox links - handle multiline iframes
  cleanedContent = cleanedContent.replace(
    /<iframe[\s\S]*?src=["']([^"']*codesandbox\.io[^"']*)["'][\s\S]*?(?:><\/iframe>|\/?>)/g,
    (match, src) => {
      // Extract the sandbox URL and convert to direct link
      const sandboxUrl = src.includes('?') ? src.split('?')[0] : src;
      const directUrl = sandboxUrl.replace('/embed/', '/s/');
      return `\n**[Live Example](${directUrl})**\n`;
    }
  );

  // Remove any remaining JSX-style tags that might be left over
  cleanedContent = cleanedContent.replace(/<\/?(?:Tabs|TabItem)[^>]*>/g, '');
  
  // Clean up any excessive whitespace that might have been left
  cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Remove leading whitespace/newlines
  cleanedContent = cleanedContent.replace(/^\s*\n+/, '');
  
  return cleanedContent;
}

function getFilesInDirectory(dirPath, extensions = ['.md', '.mdx']) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = fs.readdirSync(dirPath)
    .filter(file => {
      const ext = path.extname(file);
      return extensions.includes(ext);
    })
    .filter(file => !file.startsWith('_')) // Skip category files
    .sort();

  return files;
}

function generateAIIndex(consolidatedContent) {
  const index = [];
  const structure = extractDocumentStructure(consolidatedContent);
  
  index.push('### **Document Structure & Quick Navigation**');
  index.push('');
  
  for (const section of structure) {
    if (section.level === 1) {
      // Skip the main document title and AI index section
      if (section.title.includes('Complete Documentation') || 
          section.title.includes('AI Agent Quick Reference')) {
        continue;
      }
      
      index.push(`- [**${section.title}**](#${section.anchor || ''})`);
      
      // Add ALL subsections - no truncation
      const subsections = structure.filter(s => 
        s.level === 2 && 
        s.index > section.index && 
        (structure.find(next => next.level === 1 && next.index > section.index)?.index || Infinity) > s.index
      );
      
      if (subsections.length > 0) {
        for (const subsection of subsections) {
          index.push(`  - [${subsection.title}](#${subsection.anchor || ''})`);
        }
      }
      index.push('');
    }
  }
  
  // Generate keyword index by scanning the content
  const keywords = extractKeywords(consolidatedContent);
  index.push('### **API & Keywords Quick Reference**');
  index.push('```');
  index.push(`Hooks: ${keywords.hooks.join(', ')}`);
  index.push(`Methods: ${keywords.methods.join(', ')}`);
  index.push(`Features: ${keywords.features.join(', ')}`);
  index.push('```');
  
  return index;
}

function extractDocumentStructure(content) {
  const structure = [];
  const lines = content.join('\n').split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();
      const anchor = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '');
      
      structure.push({
        level,
        title,
        anchor,
        index: i
      });
    }
  }
  
  return structure;
}

function extractKeywords(content) {
  const fullText = content.join('\n');
  
  const keywords = {
    hooks: [
      'useAllState',
      'useClearExceptionFor', 
      'useDispatch',
      'useDispatchAll',
      'useDispatchAndWait',
      'useDispatchAndWaitAll',
      'useExceptionFor',
      'useIsFailed',
      'useIsWaiting',
      'useObject',
      'useSelect'
    ],
    methods: [],
    features: [
      'checkInternet',
      'debounce', 
      'nonReentrant',
      'optimisticUpdate',
      'retry',
      'throttle'
    ]
  };
  
  // Extract methods (common dispatch and action methods)
  const methodPatterns = [
    /\b(dispatch|dispatchAll|dispatchAndWait|dispatchAndWaitAll)\b/g,
    /\b(reduce|waitCondition)\b/g,
    /\b(createStore)\b/g
  ];
  
  methodPatterns.forEach(pattern => {
    const matches = fullText.match(pattern) || [];
    keywords.methods.push(...matches);
  });
  keywords.methods = [...new Set(keywords.methods)].sort();
  
  return keywords;
}

function generateConsolidatedDocs() {
  console.log('🚀 Generating consolidated Kiss State Management documentation...');
  
  let consolidatedContent = [];
  
  // Add header
  consolidatedContent.push('# Kiss State Management for React - Complete Documentation');
  consolidatedContent.push('');
  consolidatedContent.push('*This file can be used by AI agents. It contains the full documentation from https://kissforreact.org/ in a single file.*');
  consolidatedContent.push('*Last updated: ' + new Date().toISOString().split('T')[0] + '*');
  consolidatedContent.push('');
  
  // We'll generate the AI index after building all content
  const indexPlaceholder = consolidatedContent.length;
  consolidatedContent.push('## AI Agent Quick Reference Index');
  consolidatedContent.push('');
  consolidatedContent.push('*Use this index to quickly locate relevant sections without scanning the entire document.*');
  consolidatedContent.push('');
  consolidatedContent.push('INDEX_PLACEHOLDER');
  consolidatedContent.push('');
  consolidatedContent.push('---');
  consolidatedContent.push('');

  // Add homepage overview first
  console.log('📄 Adding homepage overview...');
  const overviewContent = readMarkdownFile(HOMEPAGE_OVERVIEW);
  if (overviewContent) {
    consolidatedContent.push('# Overview');
    consolidatedContent.push('');
    consolidatedContent.push(overviewContent);
    consolidatedContent.push('');
    consolidatedContent.push('---');
    consolidatedContent.push('');
  }

  // Process sections in order
  for (const section of SECTION_ORDER) {
    const sectionPath = path.join(REACT_DOCS_DIR, section.path);
    
    console.log(`📂 Processing section: ${section.title}`);
    
    if (section.isDirectory) {
      // Handle directory sections
      consolidatedContent.push(`# ${section.title}`);
      consolidatedContent.push('');

      let files;
      if (section.path === 'tutorial') {
        // Use predefined order for tutorial
        files = TUTORIAL_ORDER;
      } else {
        files = getFilesInDirectory(sectionPath);
      }

      for (const file of files) {
        const filePath = path.join(sectionPath, file);
        
        const fileName = path.basename(file, path.extname(file));
        const title = fileName
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
          .replace(/\.mdx?$/, '');
        
        const content = readMarkdownFile(filePath, title);
        
        if (content) {
          console.log(`  📄 Adding: ${title}`);
          consolidatedContent.push(`## ${title}`);
          consolidatedContent.push('');
          consolidatedContent.push(content);
          consolidatedContent.push('');
        }
      }
    } else {
      // Handle individual files
      const content = readMarkdownFile(sectionPath, section.title);
      if (content) {
        console.log(`  📄 Adding: ${section.title}`);
        consolidatedContent.push(`# ${section.title}`);
        consolidatedContent.push('');
        consolidatedContent.push(content);
        consolidatedContent.push('');
      }
    }
    
    consolidatedContent.push('---');
    consolidatedContent.push('');
  }

  // Now generate the AI index based on the actual content structure
  console.log('📋 Generating AI index from document structure...');
  const aiIndex = generateAIIndex(consolidatedContent);
  
  // Replace the placeholder with the actual index
  const placeholderIndex = consolidatedContent.findIndex(line => line === 'INDEX_PLACEHOLDER');
  if (placeholderIndex !== -1) {
    consolidatedContent.splice(placeholderIndex, 1, ...aiIndex);
  }

  // Write the consolidated file
  const finalContent = consolidatedContent.join('\n');
  fs.writeFileSync(OUTPUT_FILE, finalContent);
  
  console.log(`✅ Consolidated documentation generated: ${OUTPUT_FILE}`);
  console.log(`📊 Total size: ${Math.round(finalContent.length / 1024)}KB`);
  
  return OUTPUT_FILE;
}

// Run the script if called directly
if (require.main === module) {
  try {
    generateConsolidatedDocs();
  } catch (error) {
    console.error('❌ Error generating consolidated docs:', error);
    process.exit(1);
  }
}

module.exports = { generateConsolidatedDocs };