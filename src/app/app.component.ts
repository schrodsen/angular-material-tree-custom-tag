import { FlatTreeControl } from '@angular/cdk/tree'
import { Component, Injectable } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { of as observableOf, Observable, BehaviorSubject } from 'rxjs';
import { files } from './example_data';
import {CdkDragDrop} from '@angular/cdk/drag-drop';
import { SelectionModel } from '@angular/cdk/collections';

/** File node data with nested structure. */
export interface FileNode {
  nodeId: string;
  name: string;
  type: string;
  counter: number;
  children?: FileNode[];
}

/** Flat node with expandable and level information */
export class TreeNode {
  nodeId: string;
  name: string;
  type: string;
  level: number;
  expandable: boolean;
  counter: number;
}

/**
 * Update Type
 */
 export interface UpType {
  index: number;
  item: FileNode;
}

/**
 * Checklist database, it can build a tree structured Json object.
 * Each node in Json object represents a to-do item or a category.
 * If a node is a category, it has children items and new items can be added under the category.
 */
 @Injectable()
 export class TreeDatabase {
   dataChange: BehaviorSubject<FileNode[]> = new BehaviorSubject<FileNode[]>([]);
 
   get data(): FileNode[] { return this.dataChange.value; }
 
   constructor() {
     this.initialize();
   }
 
   initialize() {
     // Build the tree nodes from Json object. The result is a list of `TodoItemNode` with nested
     //     file node as children.
     const data = files
 
     // Notify the change.
     this.dataChange.next(data);
   }
 
   /** Add an item to to-do list */
   insertItem(parent: FileNode, label: string) {
     const child = <FileNode>{ name: label };
     
     if (parent.children) { 
       parent.children.push(child);
       this.dataChange.next(this.data);
     }
     else { 
       parent.children = [];
       parent.children.push(child);
       this.dataChange.next(this.data);
     }
   }
 
   removeRootItem(nodeId: string) {
    this.dataChange.next(this.data.filter(obj => obj.nodeId != nodeId));
   }

   removeChildItem(parent: FileNode, nodeId: string) {
    parent.children = parent.children.filter(obj => obj.nodeId !== nodeId)
    this.dataChange.next(this.data);
   }
 }

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ],
  providers: [TreeDatabase]
})
export class AppComponent {

  /** Map from flat node to nested node. This helps us finding the nested node to be modified */
  flatNodeMap: Map<TreeNode, FileNode> = new Map<TreeNode, FileNode>();

  /** Map from nested node to flattened node. This helps us to keep the same object for selection */
  nestedNodeMap: Map<FileNode, TreeNode> = new Map<FileNode, TreeNode>();

  /** The TreeControl controls the expand/collapse state of tree nodes.  */
  treeControl: FlatTreeControl<TreeNode>;

  /** The TreeFlattener is used to generate the flat list of items from hierarchical data. */
  treeFlattener: MatTreeFlattener<FileNode, TreeNode>;

  /** The MatTreeFlatDataSource connects the control and flattener to provide data. */
  dataSource: MatTreeFlatDataSource<FileNode, TreeNode>;

  /** The new item's name */
  newItemName = '';
  newNodeLabel = '';
  dragging = false;
  expandTimeout: any;
  expandDelay = 1000;
  validateDrop = false;
  // expansion model tracks expansion state
  expansionModel = new SelectionModel<string>(true);

  constructor(private database: TreeDatabase) {
    this.treeFlattener = new MatTreeFlattener(
      this.transformer,
      this.getLevel,
      this.isExpandable,
      this.getChildren);
  
    this.treeControl = new FlatTreeControl<TreeNode>(this.getLevel, this.isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
    this.dataSource.data = files;

    database.dataChange.subscribe(data => {
      this.dataSource.data = data;
      // this.refreshTree();
    });
  }

  /** Transform the data to something the tree can read. */
  // transformer(node: FileNode, level: number) {

  //   return {
  //     name: node.name,
  //     type: node.type,
  //     level: level,
  //     expandable: !!node.children,
  //     counter: node.counter,
  //   };
  // }

  transformer = (node: FileNode, level: number) => {
    let flatNode = this.nestedNodeMap.has(node) && this.nestedNodeMap.get(node)!.name === node.name
      ? this.nestedNodeMap.get(node)!
      : new TreeNode();
    flatNode.nodeId = node.nodeId;
    flatNode.name = node.name;
    flatNode.level = level;
    flatNode.counter = node.counter;
    flatNode.expandable = !!node.children;
    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  }

 /** Get the level of the node */
  getLevel(node: TreeNode) {
    return node.level;
  }

  /** Return whether the node is expanded or not. */
  isExpandable(node: TreeNode) {
    return node.expandable;
  };

  /** Get the children for the node. */
  getChildren(node: FileNode) {
    return observableOf(node.children);
  }

  /** Get whether the node has children or not. */
  hasChild(index: number, node: TreeNode){
    return node.expandable;
  }

  /** Get whether the node is new. */
  hasNoContent = (_: number, _nodeData: TreeNode) => _nodeData.name === '';

  /** Node without children and media */
  hasNoMedia = (_: number, _nodeData: TreeNode) => _nodeData.counter === 0 && _nodeData.expandable === false;

  refreshTree() {
    let _data = this.dataSource.data;
    this.dataSource.data = [];
    this.dataSource.data = _data;
  }

  addNewRoot() {
    let element = <HTMLElement> document.getElementById("newRoot");
    element.style.display = 'flex';

    let inputElement = <HTMLElement> document.getElementById("inputRoot");
    inputElement.focus();
  }

  hideNewRootNode() {
    let element = <HTMLElement> document.getElementById("newRoot");
    element.style.display = 'none';
  }

  saveNewRootNode() {
    // ToDo: save node
    this.hideNewRootNode();

    const fileNode = <FileNode> { name: this.newNodeLabel, nodeId: 'DEMO', counter: 0, type: 'folder' };
    this.database.data.push(fileNode);

    this.newNodeLabel = '';
    this.refreshTree();
  }

  addNewNode(node: TreeNode) {

    console.log(node);

    // Only allow one instance for a new node
    if (this.treeControl.dataNodes.findIndex(obj => obj.name === '') !== -1)
    {
      console.log(this.treeControl.dataNodes);
      console.log("y");
      return;
    }
    const parentNode = this.flatNodeMap.get(node);
    // 
    let isParentHasChildren: boolean = false;
    if (parentNode.children)
      isParentHasChildren = true;
    //
    this.database.insertItem(parentNode!, '');

    // expand the subtree only if the parent has children (parent is not a leaf node)
    //if (isParentHasChildren)
    this.treeControl.expand(node);
    this.refreshTree();

    let element = <HTMLElement> document.getElementById("inputChild");
    element.focus();
  }

  deleteNode(node: TreeNode) {
    const nodeId = this.flatNodeMap.get(node).nodeId;

    if (node.level === 0) {
      this.database.removeRootItem(nodeId);
     } else {
      let parentTreeNode = this.getParentNode(node);
      const parentFileNode = this.flatNodeMap.get(parentTreeNode);
      this.database.removeChildItem(parentFileNode, nodeId);
      
      if (parentFileNode.children.length === 0) {
          parentFileNode.children = null;
      }
     }

    this.refreshTree();
  }

  saveNode(node: TreeNode) {
      console.log(node);
      console.log(this.newNodeLabel);
      //node.name = this.newNodeLabel;

      const fileNode = this.flatNodeMap.get(node);
      fileNode.name = this.newNodeLabel;
      fileNode.counter = 0;

      this.treeControl.expand(this.getParentNode(node));
      this.refreshTree();
      this.newNodeLabel = '';
  }

  cancel(node: TreeNode) {
    this.deleteNode(node);
  }

  expandAll() {
    this.treeControl.expandAll();
  }

  collapseAll() {
    this.treeControl.collapseAll();
  }

  refresh() {
    this.refreshTree();
    console.log(this.treeControl.dataNodes);
    console.log(this.database.data);
  }

  getParentNode(node: TreeNode): TreeNode | null {
    const currentLevel = this.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];

      if (this.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }

  
  /**
   * Experimental - opening tree nodes as you drag over them
   */
   dragStart() {
    this.dragging = true;
  }

  dragEnd() {
    this.dragging = false;
  }

  dragHover(node: TreeNode) {
    if (this.dragging) {
      clearTimeout(this.expandTimeout);
      this.expandTimeout = setTimeout(() => {
        this.treeControl.expand(node);
      }, this.expandDelay);
    }
  }

  dragHoverEnd() {
    if (this.dragging) {
      clearTimeout(this.expandTimeout);
    }
  }

    /**
   * Handle the drop - here we rearrange the data based on the drop event,
   * then rebuild the tree.
   * */
    drop(event: CdkDragDrop<string[]>) {
    console.log('origin/destination', event.previousIndex, event.currentIndex);

    // ignore drops outside of the tree
    if (!event.isPointerOverContainer) return;

    const direction = event.previousIndex > event.currentIndex;
    const treeNodes = this.visbileTreeNodes();
    const source: TreeNode = treeNodes[event.previousIndex];
    const target: TreeNode = treeNodes[direction ? event.currentIndex - 1 : event.currentIndex];

console.log(source);
console.log(target);

    // determine where to insert the node
    const sourceFileNode: FileNode = this.flatNodeMap.get(source);
    const targetFileNode: FileNode = this.flatNodeMap.get(target);

    if (targetFileNode.children === undefined) {
      targetFileNode.children = [];
    }

    targetFileNode.children.push(sourceFileNode);
    
    // remove the node from its old place
    const parentSource: TreeNode = this.getParentNode(source);
    const parentSourceFileNode: FileNode = this.flatNodeMap.get(parentSource);
    let idx = parentSourceFileNode.children.findIndex(node => node.nodeId === sourceFileNode.nodeId);
    parentSourceFileNode.children.splice(idx, 1);
    if (parentSourceFileNode.children.length === 0) {
      parentSourceFileNode.children = undefined;
    }

    
    // rebuild tree with mutated data
    this.refreshTree();

    const nodeToExpand = this.treeControl.dataNodes.find(node => node.nodeId === target.nodeId);
    this.treeControl.expand(nodeToExpand);
  }

  visbileTreeNodes(): TreeNode[] {
    const result = [];
    
    this.treeControl.dataNodes.forEach(node => {
      let parent = this.getParentNode(node);
      if (parent !== null) {
        if (this.treeControl.isExpanded(parent) === true) {
          result.push(node);
        }
      } else {
        result.push(node);
      }
    });
    
    return result;
  }
}