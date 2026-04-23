// Couche projet — expose les composants UI utilisés dans carto-ecp.
// Ré-exporte les composants du Design System RTE officiel
// (@design-system-rte/react@^1.8.0) pour importer via @/components/ui
// et ajoute 6 composants maison pour les besoins non couverts par le DS
// (Table, RangeSlider, ColorField, DateTimeField, Skeleton, EmptyState).

export {
  Accordion,
  Avatar,
  Badge,
  Banner,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Chip,
  Divider,
  Drawer,
  FileUpload,
  Grid,
  Icon,
  IconButton,
  IconButtonToggle,
  Link as DsLink,
  Loader,
  Modal,
  Popover,
  RadioButton,
  RadioButtonGroup,
  Searchbar,
  SegmentedControl,
  Select,
  SideNav,
  SplitButton,
  Stepper,
  Switch,
  Tab,
  Tag,
  Textarea,
  TextInput,
  Toast,
  ToastQueueProvider,
  Tooltip,
  Treeview,
} from '@design-system-rte/react';

// Composants maison (non-DS) pour les besoins métier carto-ecp
export { Table } from './Table/Table.js';
export { RangeSlider } from './RangeSlider/RangeSlider.js';
export { ColorField } from './ColorField/ColorField.js';
export { DateTimeField } from './DateTimeField/DateTimeField.js';
export { Skeleton, type SkeletonVariant } from './Skeleton/Skeleton.js';
export { EmptyState } from './EmptyState/EmptyState.js';
