import { Layers, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Page2() {
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Page 2</h1>
            <p className="text-muted-foreground">
              Another demo page for your application template.
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create New
          </Button>
        </div>

        <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
          <div className="text-center space-y-4">
            <Layers className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">Build something amazing</h3>
              <p className="text-muted-foreground">
                This page is ready for your custom functionality.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 