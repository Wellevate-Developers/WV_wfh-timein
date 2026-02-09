import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Read the CSV file from the data folder at project root
    const filePath = path.join(process.cwd(), 'data', 'Attendance.csv');
    const fileContent = await readFile(filePath, 'utf-8');
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error reading Attendance.csv:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'File not found',
        message: 'Make sure Attendance.csv exists in the data folder at project root',
        path: path.join(process.cwd(), 'data', 'Attendance.csv')
      }), 
      { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}